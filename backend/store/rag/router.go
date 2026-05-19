package rag

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

// RAGRouter 根据系统设置动态路由到不同的 RAG 实现
// 支持在向量检索和全文检索之间切换
type RAGRouter struct {
	ftsRAG    RAGService // PostgreSQL FTS 实现
	vectorRAG RAGService // CT RAG 向量实现 (可能为 nil)
	db        *pg.DB
	logger    *log.Logger
	mu        sync.RWMutex
	cachedMode string
}

func NewRAGRouter(config *config.Config, db *pg.DB, logger *log.Logger) (*RAGRouter, error) {
	router := &RAGRouter{
		db:     db,
		logger: logger.WithModule("store.rag.router"),
	}

	// 始终创建 FTS 实现
	router.ftsRAG = NewPgFTSRAG(db, logger)

	// 尝试创建向量检索实现
	if config.RAG.Provider == "ct" && config.RAG.CTRAG.BaseURL != "" {
		vectorRAG, err := NewCTRAG(config, logger)
		if err != nil {
			logger.Warn("failed to create vector RAG, FTS only mode", log.Error(err))
		} else {
			router.vectorRAG = vectorRAG
		}
	}

	return router, nil
}

// getSearchMode 从数据库获取当前检索模式
func (r *RAGRouter) getSearchMode(ctx context.Context) string {
	r.mu.RLock()
	if r.cachedMode != "" {
		mode := r.cachedMode
		r.mu.RUnlock()
		return mode
	}
	r.mu.RUnlock()

	// 从数据库读取设置
	var setting domain.SystemSetting
	if err := r.db.WithContext(ctx).
		Where("key = ?", consts.SystemSettingSearchMode).
		First(&setting).Error; err != nil {
		// 默认使用 FTS
		return "fts"
	}

	var modeSetting domain.SearchModeSetting
	if err := json.Unmarshal(setting.Value, &modeSetting); err != nil {
		return "fts"
	}

	r.mu.Lock()
	r.cachedMode = modeSetting.Mode
	r.mu.Unlock()

	if modeSetting.Mode == "" {
		return "fts"
	}
	return modeSetting.Mode
}

// InvalidateCache 清除缓存的检索模式（设置变更时调用）
func (r *RAGRouter) InvalidateCache() {
	r.mu.Lock()
	r.cachedMode = ""
	r.mu.Unlock()
}

// getActiveRAG 根据当前模式返回对应的 RAG 实现
func (r *RAGRouter) getActiveRAG(ctx context.Context) RAGService {
	mode := r.getSearchMode(ctx)
	switch mode {
	case "vector":
		if r.vectorRAG != nil {
			return r.vectorRAG
		}
		r.logger.Warn("vector RAG not available, falling back to FTS")
		return r.ftsRAG
	default: // "fts"
		return r.ftsRAG
	}
}

// --- RAGService 接口实现 ---

func (r *RAGRouter) CreateKnowledgeBase(ctx context.Context) (string, error) {
	return r.getActiveRAG(ctx).CreateKnowledgeBase(ctx)
}

func (r *RAGRouter) UpsertRecords(ctx context.Context, req *UpsertRecordsRequest) (string, error) {
	mode := r.getSearchMode(ctx)
	// UpsertRecords 需要同时写入两个实现，确保切换时数据一致
	// FTS 由触发器自动处理，始终可用
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.UpsertRecords(ctx, req)
	}
	return r.ftsRAG.UpsertRecords(ctx, req)
}

func (r *RAGRouter) QueryRecords(ctx context.Context, req *QueryRecordsRequest) (string, []*domain.NodeContentChunk, error) {
	return r.getActiveRAG(ctx).QueryRecords(ctx, req)
}

func (r *RAGRouter) DeleteRecords(ctx context.Context, datasetID string, docIDs []string) error {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.DeleteRecords(ctx, datasetID, docIDs)
	}
	return r.ftsRAG.DeleteRecords(ctx, datasetID, docIDs)
}

func (r *RAGRouter) DeleteKnowledgeBase(ctx context.Context, datasetID string) error {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.DeleteKnowledgeBase(ctx, datasetID)
	}
	return r.ftsRAG.DeleteKnowledgeBase(ctx, datasetID)
}

func (r *RAGRouter) UpdateDocumentGroupIDs(ctx context.Context, datasetID string, docID string, groupIds []int) error {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.UpdateDocumentGroupIDs(ctx, datasetID, docID, groupIds)
	}
	return r.ftsRAG.UpdateDocumentGroupIDs(ctx, datasetID, docID, groupIds)
}

func (r *RAGRouter) ListDocuments(ctx context.Context, datasetID string, documentIDs []string) ([]Document, error) {
	return r.getActiveRAG(ctx).ListDocuments(ctx, datasetID, documentIDs)
}

func (r *RAGRouter) GetModelList(ctx context.Context) ([]*domain.Model, error) {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.GetModelList(ctx)
	}
	return r.ftsRAG.GetModelList(ctx)
}

func (r *RAGRouter) AddModel(ctx context.Context, model *domain.Model) (string, error) {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.AddModel(ctx, model)
	}
	return r.ftsRAG.AddModel(ctx, model)
}

func (r *RAGRouter) UpdateModel(ctx context.Context, model *domain.Model) error {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.UpdateModel(ctx, model)
	}
	return r.ftsRAG.UpdateModel(ctx, model)
}

func (r *RAGRouter) UpsertModel(ctx context.Context, model *domain.Model) error {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.UpsertModel(ctx, model)
	}
	return r.ftsRAG.UpsertModel(ctx, model)
}

func (r *RAGRouter) DeleteModel(ctx context.Context, model *domain.Model) error {
	mode := r.getSearchMode(ctx)
	if mode == "vector" && r.vectorRAG != nil {
		return r.vectorRAG.DeleteModel(ctx, model)
	}
	return r.ftsRAG.DeleteModel(ctx, model)
}
