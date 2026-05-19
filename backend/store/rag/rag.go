package rag

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/schema"
	"github.com/google/wire"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type QueryRecordsRequest struct {
	DatasetID           string
	Query               string
	GroupIDs            []int
	Tags                []string
	SimilarityThreshold float64
	HistoryMsgs         []*schema.Message
	MaxChunksPerDoc     int
}

type UpsertRecordsRequest struct {
	ID        string
	DatasetID string
	DocID     string
	Title     string
	Content   string
	GroupIDs  []int
	Tags      []string
}

type DocumentMetadata struct {
	GroupIDs []int `json:"group_ids"`
}

type Document struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	DatasetID   string           `json:"dataset_id"`
	Status      string           `json:"status"`
	ProgressMsg string           `json:"progress_msg"`
	MetaData    DocumentMetadata `json:"meta_data"`
	Tags        []string         `json:"tags"`
}

type RAGService interface {
	CreateKnowledgeBase(ctx context.Context) (string, error)
	UpsertRecords(ctx context.Context, req *UpsertRecordsRequest) (string, error)
	QueryRecords(ctx context.Context, req *QueryRecordsRequest) (string, []*domain.NodeContentChunk, error)
	DeleteRecords(ctx context.Context, datasetID string, docIDs []string) error
	DeleteKnowledgeBase(ctx context.Context, datasetID string) error
	UpdateDocumentGroupIDs(ctx context.Context, datasetID string, docID string, groupIds []int) error
	ListDocuments(ctx context.Context, datasetID string, documentIDs []string) ([]Document, error)

	GetModelList(ctx context.Context) ([]*domain.Model, error)
	AddModel(ctx context.Context, model *domain.Model) (string, error)
	UpdateModel(ctx context.Context, model *domain.Model) error
	UpsertModel(ctx context.Context, model *domain.Model) error
	DeleteModel(ctx context.Context, model *domain.Model) error
}

func NewRAGService(config *config.Config, db *pg.DB, logger *log.Logger) (RAGService, error) {
	switch config.RAG.Provider {
	case "ct":
		// 使用 RAGRouter 支持动态切换
		return NewRAGRouter(config, db, logger)
	case "noop":
		logger.Info("Using NoopRAG (RAG explicitly disabled)")
		return NewNoopRAG(logger), nil
	case "fts":
		logger.Info("Using PgFTSRAG (full-text search mode)")
		return NewPgFTSRAG(db, logger), nil
	case "":
		// 默认使用 RAGRouter（支持动态切换，默认 FTS）
		return NewRAGRouter(config, db, logger)
	default:
		return nil, fmt.Errorf("unsupported RAG provider: %s", config.RAG.Provider)
	}
}

var ProviderSet = wire.NewSet(NewRAGService)
