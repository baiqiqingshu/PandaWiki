package setup

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
	"github.com/chaitin/panda-wiki/store/rag"
)

// AutoInitKnowledgeBase 在启动时自动初始化知识库站点。
// 当配置了 WIKI_NAME 和 WIKI_SITE_PORT 且数据库中还没有知识库时，自动创建一个。
func AutoInitKnowledgeBase(db *pg.DB, ragService rag.RAGService, cfg *config.Config, logger *log.Logger) error {
	if cfg.WikiName == "" {
		return nil
	}
	port := cfg.WikiSitePort
	if port == 0 {
		port = 8005 // 默认端口
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 检查是否已有知识库
	var count int64
	if err := db.WithContext(ctx).Model(&domain.KnowledgeBase{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check existing knowledge bases: %w", err)
	}
	if count > 0 {
		logger.Info("knowledge base already exists, skip auto init",
			log.Int64("count", count),
		)
		return nil
	}

	logger.Info("auto initializing knowledge base from ENV",
		log.String("wiki_name", cfg.WikiName),
		log.Int("wiki_site_port", port),
	)

	// 创建 RAG 数据集
	datasetID, err := ragService.CreateKnowledgeBase(ctx)
	if err != nil {
		return fmt.Errorf("failed to create RAG dataset: %w", err)
	}

	kbID := uuid.New().String()

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 创建知识库
		kb := &domain.KnowledgeBase{
			ID:        kbID,
			Name:      cfg.WikiName,
			DatasetID: datasetID,
			AccessSettings: domain.AccessSettings{
				Ports: []int{port},
				Hosts: []string{"*"}, // 监听所有域名
			},
		}
		if err := tx.Create(kb).Error; err != nil {
			return fmt.Errorf("failed to create knowledge base: %w", err)
		}

		// 创建默认导航
		nav := &domain.Nav{
			ID:   uuid.New().String(),
			Name: cfg.WikiName,
			KbID: kbID,
		}
		if err := tx.Create(nav).Error; err != nil {
			return fmt.Errorf("failed to create nav: %w", err)
		}

		// 创建默认 App
		type AppBtn struct {
			ID       string `json:"id"`
			Icon     string `json:"icon"`
			ShowIcon bool   `json:"showIcon"`
			Target   string `json:"target"`
			Text     string `json:"text"`
			URL      string `json:"url"`
			Variant  string `json:"variant"`
		}
		app := &domain.App{
			ID:   uuid.New().String(),
			KBID: kbID,
			Name: cfg.WikiName,
			Type: domain.AppTypeWeb,
			Settings: domain.AppSettings{
				Title:      cfg.WikiName,
				Desc:       cfg.WikiName,
				Keyword:    cfg.WikiName,
				Icon:       domain.DefaultPandaWikiIconB64,
				WelcomeStr: fmt.Sprintf("欢迎使用%s", cfg.WikiName),
				Btns: []any{
					AppBtn{
						ID:       uuid.New().String(),
						Icon:     domain.DefaultGitHubIconB64,
						ShowIcon: true,
						Target:   "_blank",
						Text:     "GitHub",
						URL:      "https://ly.safepoint.cloud/XEyeWqL",
						Variant:  "contained",
					},
					AppBtn{
						ID:       uuid.New().String(),
						Icon:     "",
						ShowIcon: false,
						Target:   "_blank",
						Text:     "PandaWiki",
						URL:      "https://pandawiki.docs.baizhi.cloud",
						Variant:  "outlined",
					},
				},
			},
		}
		if err := tx.Create(app).Error; err != nil {
			return fmt.Errorf("failed to create app: %w", err)
		}

		logger.Info("auto init knowledge base completed",
			log.String("kb_id", kbID),
			log.String("name", cfg.WikiName),
			log.Int("port", port),
		)

		return nil
	})
}
