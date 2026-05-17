package rag

import (
	"context"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
)

// NoopRAG 是一个空操作的 RAG 实现，当没有配置外部 RAG 服务时使用。
// 所有向量/检索相关操作都返回空结果而不是报错，使系统可以在没有 RAG 的情况下运行基础功能。
type NoopRAG struct {
	logger *log.Logger
}

func NewNoopRAG(logger *log.Logger) *NoopRAG {
	return &NoopRAG{
		logger: logger.WithModule("store.rag.noop"),
	}
}

func (s *NoopRAG) CreateKnowledgeBase(ctx context.Context) (string, error) {
	// 返回一个虚拟的 dataset ID
	id := uuid.New().String()
	s.logger.Info("NoopRAG: created virtual knowledge base", log.String("dataset_id", id))
	return id, nil
}

func (s *NoopRAG) UpsertRecords(ctx context.Context, req *UpsertRecordsRequest) (string, error) {
	s.logger.Info("NoopRAG: skip upsert records (RAG not configured)")
	return req.DocID, nil
}

func (s *NoopRAG) QueryRecords(ctx context.Context, req *QueryRecordsRequest) (string, []*domain.NodeContentChunk, error) {
	s.logger.Info("NoopRAG: skip query records (RAG not configured)")
	return req.Query, nil, nil
}

func (s *NoopRAG) DeleteRecords(ctx context.Context, datasetID string, docIDs []string) error {
	return nil
}

func (s *NoopRAG) DeleteKnowledgeBase(ctx context.Context, datasetID string) error {
	return nil
}

func (s *NoopRAG) UpdateDocumentGroupIDs(ctx context.Context, datasetID string, docID string, groupIds []int) error {
	return nil
}

func (s *NoopRAG) ListDocuments(ctx context.Context, datasetID string, documentIDs []string) ([]Document, error) {
	return nil, nil
}

func (s *NoopRAG) GetModelList(ctx context.Context) ([]*domain.Model, error) {
	return nil, nil
}

func (s *NoopRAG) AddModel(ctx context.Context, model *domain.Model) (string, error) {
	return uuid.New().String(), nil
}

func (s *NoopRAG) UpdateModel(ctx context.Context, model *domain.Model) error {
	return nil
}

func (s *NoopRAG) UpsertModel(ctx context.Context, model *domain.Model) error {
	return nil
}

func (s *NoopRAG) DeleteModel(ctx context.Context, model *domain.Model) error {
	return nil
}
