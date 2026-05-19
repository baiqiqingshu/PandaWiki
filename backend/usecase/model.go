package usecase

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/cloudwego/eino/schema"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/mq"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/store/rag"
)

type ModelUsecase struct {
	modelRepo         *pg.ModelRepository
	logger            *log.Logger
	config            *config.Config
	nodeRepo          *pg.NodeRepository
	ragRepo           *mq.RAGRepository
	ragStore          rag.RAGService
	kbRepo            *pg.KnowledgeBaseRepository
	systemSettingRepo *pg.SystemSettingRepo
}

func NewModelUsecase(modelRepo *pg.ModelRepository, nodeRepo *pg.NodeRepository, ragRepo *mq.RAGRepository, ragStore rag.RAGService, logger *log.Logger, config *config.Config, kbRepo *pg.KnowledgeBaseRepository, settingRepo *pg.SystemSettingRepo) *ModelUsecase {
	u := &ModelUsecase{
		modelRepo:         modelRepo,
		logger:            logger.WithModule("usecase.model"),
		config:            config,
		nodeRepo:          nodeRepo,
		ragRepo:           ragRepo,
		ragStore:          ragStore,
		kbRepo:            kbRepo,
		systemSettingRepo: settingRepo,
	}
	return u
}

func (u *ModelUsecase) Create(ctx context.Context, model *domain.Model) error {
	var updatedEmbeddingModel bool
	if model.Type == domain.ModelTypeEmbedding {
		updatedEmbeddingModel = true
	}
	if err := u.modelRepo.Create(ctx, model); err != nil {
		return err
	}
	// 模型更新成功后，如果更新嵌入模型，则触发记录更新
	if updatedEmbeddingModel {
		if _, err := u.updateModeSettingConfig(ctx, "", "", "", true); err != nil {
			return err
		}
	}
	return nil
}

func (u *ModelUsecase) GetList(ctx context.Context) ([]*domain.ModelListItem, error) {
	return u.modelRepo.GetList(ctx)
}

// trigger upsert records after embedding model is updated or created
func (u *ModelUsecase) TriggerUpsertRecords(ctx context.Context) error {
	// update to new dataset
	kbList, err := u.kbRepo.GetKnowledgeBaseList(ctx)
	if err != nil {
		return fmt.Errorf("get knowledge base list failed: %w", err)
	}
	for _, kb := range kbList {
		newDatasetID, err := u.ragStore.CreateKnowledgeBase(ctx)
		if err != nil {
			return fmt.Errorf("create new dataset failed: %w", err)
		}
		if err := u.ragStore.DeleteKnowledgeBase(ctx, kb.DatasetID); err != nil {
			return fmt.Errorf("delete old dataset failed: %w", err)
		}
		if err := u.kbRepo.UpdateDatasetID(ctx, kb.ID, newDatasetID); err != nil {
			return fmt.Errorf("update knowledge base dataset id failed: %w", err)
		}
	}
	// traverse all nodes
	err = u.nodeRepo.TraverseNodesByCursor(ctx, func(nodeRelease *domain.NodeRelease) error {
		// async upsert vector content via mq
		nodeContentVectorRequests := []*domain.NodeReleaseVectorRequest{
			{
				KBID:          nodeRelease.KBID,
				NodeReleaseID: nodeRelease.ID,
				Action:        "upsert",
			},
		}
		if err := u.ragRepo.AsyncUpdateNodeReleaseVector(ctx, nodeContentVectorRequests); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}

func (u *ModelUsecase) Update(ctx context.Context, req *domain.UpdateModelReq) error {
	var updatedEmbeddingModel bool
	if req.Type == domain.ModelTypeEmbedding {
		updatedEmbeddingModel = true
	}
	if err := u.modelRepo.Update(ctx, req); err != nil {
		return err
	}
	data := &domain.Model{
		Provider:   req.Provider,
		Model:      req.Model,
		Type:       req.Type,
		APIKey:     req.APIKey,
		BaseURL:    req.BaseURL,
		APIHeader:  req.APIHeader,
		APIVersion: req.APIVersion,
	}
	if req.IsActive != nil {
		data.IsActive = *req.IsActive
	}
	if req.Parameters != nil {
		data.Parameters = *req.Parameters
	}
	if err := u.ragStore.UpsertModel(ctx, data); err != nil {
		return err
	}
	// 模型更新成功后，如果更新嵌入模型，则触发记录更新
	if updatedEmbeddingModel {
		if _, err := u.updateModeSettingConfig(ctx, "", "", "", true); err != nil {
			return err
		}
	}
	return nil
}

func (u *ModelUsecase) GetChatModel(ctx context.Context) (*domain.Model, error) {
	model, err := u.modelRepo.GetChatModel(ctx)
	if err != nil {
		return nil, err
	}
	return model, nil
}

func (u *ModelUsecase) GetModelByType(ctx context.Context, modelType domain.ModelType) (*domain.Model, error) {
	return u.modelRepo.GetModelByType(ctx, modelType)
}

func (u *ModelUsecase) UpdateUsage(ctx context.Context, modelID string, usage *schema.TokenUsage) error {
	return u.modelRepo.UpdateUsage(ctx, modelID, usage)
}

func (u *ModelUsecase) SwitchMode(ctx context.Context, req *domain.SwitchModeReq) error {
	// 仅支持手动模式
	if consts.ModelSettingMode(req.Mode) != consts.ModelSettingModeManual {
		return fmt.Errorf("仅支持手动模式 (manual)")
	}

	needModelTypes := []domain.ModelType{
		domain.ModelTypeChat,
		domain.ModelTypeEmbedding,
		domain.ModelTypeRerank,
		domain.ModelTypeAnalysis,
	}
	for _, modelType := range needModelTypes {
		model, err := u.modelRepo.GetModelByType(ctx, modelType)
		if err != nil {
			return fmt.Errorf("需要配置 %s 模型", modelType)
		}

		if !model.IsActive {
			if err := u.modelRepo.Updates(ctx, model.ID, map[string]any{
				"is_active": true,
			}); err != nil {
				return err
			}
		}
	}

	oldModelModeSetting, err := u.GetModelModeSetting(ctx)
	if err != nil {
		return err
	}

	_, err = u.updateModeSettingConfig(ctx, req.Mode, "", "", false)
	if err != nil {
		return err
	}

	if err := u.updateRAGModelsByMode(ctx, req.Mode, "", oldModelModeSetting); err != nil {
		return err
	}

	return nil
}

// updateModeSettingConfig 读取当前设置并更新，然后持久化
func (u *ModelUsecase) updateModeSettingConfig(ctx context.Context, mode, apiKey, chatModel string, isManualEmbeddingUpdated bool) (*domain.ModelModeSetting, error) {
	// 读取当前设置
	setting, err := u.systemSettingRepo.GetSystemSetting(ctx, consts.SystemSettingModelMode)
	if err != nil {
		return nil, fmt.Errorf("failed to get current model setting: %w", err)
	}

	var config domain.ModelModeSetting
	if err := json.Unmarshal(setting.Value, &config); err != nil {
		return nil, fmt.Errorf("failed to parse current model setting: %w", err)
	}

	// 更新设置
	if apiKey != "" {
		config.AutoModeAPIKey = apiKey
	}
	if chatModel != "" {
		config.ChatModel = chatModel
	}
	if mode != "" {
		config.Mode = consts.ModelSettingMode(mode)
	}

	config.IsManualEmbeddingUpdated = isManualEmbeddingUpdated

	// 持久化设置
	updatedValue, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated model setting: %w", err)
	}
	if err := u.systemSettingRepo.UpdateSystemSetting(ctx, string(consts.SystemSettingModelMode), string(updatedValue)); err != nil {
		return nil, fmt.Errorf("failed to update model setting: %w", err)
	}
	return &config, nil
}

func (u *ModelUsecase) GetModelModeSetting(ctx context.Context) (domain.ModelModeSetting, error) {
	setting, err := u.systemSettingRepo.GetSystemSetting(ctx, consts.SystemSettingModelMode)
	if err != nil {
		return domain.ModelModeSetting{}, fmt.Errorf("failed to get model mode setting: %w", err)
	}
	var config domain.ModelModeSetting
	if err := json.Unmarshal(setting.Value, &config); err != nil {
		return domain.ModelModeSetting{}, fmt.Errorf("failed to parse model mode setting: %w", err)
	}
	// 无效设置检查
	if config == (domain.ModelModeSetting{}) || config.Mode == "" {
		return domain.ModelModeSetting{}, fmt.Errorf("model mode setting is invalid")
	}
	return config, nil
}

// updateRAGModelsByMode 根据模式更新 RAG 模型（仅手动模式）
func (u *ModelUsecase) updateRAGModelsByMode(ctx context.Context, mode, autoModeAPIKey string, oldModelModeSetting domain.ModelModeSetting) error {
	var isTriggerUpsertRecords = true

	// 手动切换到手动模式, 根据IsManualEmbeddingUpdated字段决定
	if oldModelModeSetting.Mode == consts.ModelSettingModeManual && mode == string(consts.ModelSettingModeManual) {
		isTriggerUpsertRecords = oldModelModeSetting.IsManualEmbeddingUpdated
	}

	ragModelTypes := []domain.ModelType{
		domain.ModelTypeEmbedding,
		domain.ModelTypeRerank,
		domain.ModelTypeAnalysis,
		domain.ModelTypeAnalysisVL,
		domain.ModelTypeChat,
	}

	for _, modelType := range ragModelTypes {
		// 获取该类型的活跃模型
		m, err := u.modelRepo.GetModelByType(ctx, modelType)
		if err != nil {
			u.logger.Warn("failed to get model by type", log.String("type", string(modelType)), log.Any("error", err))
			continue
		}
		if m == nil || !m.IsActive {
			u.logger.Warn("no active model found for type", log.String("type", string(modelType)))
			continue
		}

		// 更新RAG存储中的模型
		if err := u.ragStore.UpsertModel(ctx, m); err != nil {
			u.logger.Error("failed to update model in RAG store", log.String("model_id", m.ID), log.String("type", string(modelType)), log.Any("error", err))
			return fmt.Errorf("failed to update model in RAG store: %s", m.Type)
		}
		u.logger.Info("successfully updated RAG model", log.String("model name: ", string(m.Model)))
	}

	// 触发记录更新
	if isTriggerUpsertRecords {
		u.logger.Info("embedding model updated, triggering upsert records")
		return u.TriggerUpsertRecords(ctx)
	}
	return nil
}
