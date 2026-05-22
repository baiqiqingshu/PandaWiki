package rag

import (
	"context"
	"fmt"
	stdhtml "html"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/samber/lo"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

// PgFTSRAG 基于 PostgreSQL 全文检索的 RAG 实现
// 不依赖外部向量模型和 RAGLite 服务，仅使用 PostgreSQL 内置的 tsvector/tsquery + ILIKE
type PgFTSRAG struct {
	db     *pg.DB
	logger *log.Logger
}

var (
	markdownImagePattern = regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`)
	htmlImagePattern     = regexp.MustCompile(`(?is)<img\b[^>]*>`)
	htmlTagPattern       = regexp.MustCompile(`(?s)<[^>]+>`)
	dataImagePattern     = regexp.MustCompile(`(?is)data:image/[^ \t\r\n'")>]+`)
	urlPattern           = regexp.MustCompile(`(?is)https?://[^ \t\r\n'")<]+`)
	whitespacePattern    = regexp.MustCompile(`\s+`)
)

func NewPgFTSRAG(db *pg.DB, logger *log.Logger) *PgFTSRAG {
	return &PgFTSRAG{
		db:     db,
		logger: logger.WithModule("store.rag.pg_fts"),
	}
}

func (s *PgFTSRAG) CreateKnowledgeBase(ctx context.Context) (string, error) {
	// FTS 模式下不需要创建外部知识库，返回虚拟 ID
	id := uuid.New().String()
	s.logger.Info("PgFTSRAG: created virtual knowledge base", log.String("dataset_id", id))
	return id, nil
}

func (s *PgFTSRAG) QueryRecords(ctx context.Context, req *QueryRecordsRequest) (string, []*domain.NodeContentChunk, error) {
	if req.Query == "" {
		return req.Query, nil, nil
	}

	query := strings.TrimSpace(req.Query)

	// 构建 tsquery：将查询按空格拆分，用 | (OR) 连接
	terms := strings.Fields(query)
	if len(terms) == 0 {
		return query, nil, nil
	}

	// 对于中文，simple 分词器会按字符切分，所以直接用 plainto_tsquery
	// 同时用 ILIKE 做兜底匹配

	topK := 10
	if req.MaxChunksPerDoc > 0 {
		topK = req.MaxChunksPerDoc * 5
		if topK < 10 {
			topK = 10
		}
	}

	type scoredDoc struct {
		DocID        string  `gorm:"column:doc_id"`
		NodeID       string  `gorm:"column:node_id"`
		Name         string  `gorm:"column:name"`
		Content      string  `gorm:"column:content"`
		MatchSnippet string  `gorm:"column:match_snippet"`
		Score        float64 `gorm:"column:score"`
	}

	var results []scoredDoc

	// 构建查询 SQL
	// 使用 ts_rank_cd 对 tsvector 评分 + ILIKE 命中加权
	// 使用 ts_headline 提取匹配段落作为摘要
	rawSQL := `
		SELECT 
			COALESCE(NULLIF(nr.doc_id, ''), nr.id) AS doc_id,
			nr.node_id,
			nr.name,
			LEFT(sc.search_content, 2000) as content,
			'' as match_snippet,
			(
				ts_rank_cd(COALESCE(nr.search_vector, ''::tsvector), plainto_tsquery('simple', ?)) * 100 +
				CASE WHEN nr.name ILIKE ? THEN 10 ELSE 0 END +
				CASE WHEN nr.meta->>'summary' ILIKE ? THEN 5 ELSE 0 END +
				CASE WHEN sc.search_content ILIKE ? THEN 1 ELSE 0 END
			) AS score
		FROM node_releases nr
		CROSS JOIN LATERAL (
			SELECT node_releases_search_text(nr.content) AS search_content
		) sc
		WHERE 
			nr.type = ?
			AND (
				COALESCE(nr.search_vector, ''::tsvector) @@ plainto_tsquery('simple', ?)
				OR nr.name ILIKE ?
				OR sc.search_content ILIKE ?
			)
	`

	likePattern := "%" + query + "%"
	args := []interface{}{
		query,       // ts_rank_cd
		likePattern, // name ILIKE score
		likePattern, // summary ILIKE score
		likePattern, // content ILIKE score
		domain.NodeTypeDocument,
		query,       // search_vector @@
		likePattern, // name ILIKE filter
		likePattern, // content ILIKE filter
	}

	// 如果有 DatasetID (kb_id)，通过 kb_releases 关联过滤
	if req.DatasetID != "" {
		rawSQL += `
			AND EXISTS (
				SELECT 1 FROM kb_release_node_releases krnr
				INNER JOIN kb_releases kr ON kr.id = krnr.release_id
				WHERE krnr.node_release_id = nr.id
				AND kr.kb_id = (SELECT id FROM knowledge_bases WHERE dataset_id = ? LIMIT 1)
			)
		`
		args = append(args, req.DatasetID)
	}

	// GroupIDs 权限过滤
	if len(req.GroupIDs) > 0 {
		// 通过 node_auth_groups 表过滤权限
		rawSQL += `
			AND (
				EXISTS (
					SELECT 1 FROM nodes n 
					WHERE n.id = nr.node_id 
					AND n.permissions->>'answerable' = 'open'
				)
				OR EXISTS (
					SELECT 1 FROM node_auth_groups nag 
					WHERE nag.node_id = nr.node_id 
					AND nag.perm = 'answerable'
					AND nag.auth_group_id = ANY(?)
				)
			)
		`
		args = append(args, pq.Array(req.GroupIDs))
	}

	rawSQL += `
		ORDER BY score DESC
		LIMIT ?
	`
	args = append(args, topK)

	if err := s.db.WithContext(ctx).Raw(rawSQL, args...).Scan(&results).Error; err != nil {
		s.logger.Error("PgFTSRAG: query records failed", log.Error(err))
		return query, nil, fmt.Errorf("pg fts query failed: %w", err)
	}

	s.logger.Info("PgFTSRAG: query records", log.Int("results", len(results)), log.String("query", query))

	// 过滤低分结果
	threshold := req.SimilarityThreshold
	if threshold <= 0 {
		threshold = 0.01 // 默认最低阈值
	}

	nodeChunks := make([]*domain.NodeContentChunk, 0, len(results))
	for _, r := range results {
		if r.Score < threshold {
			continue
		}
		content := normalizeSearchText(r.Content)
		snippet := normalizeSearchText(r.MatchSnippet)
		// 如果 ts_headline 没有返回结果（ILIKE 命中的情况），手动从 content 中提取匹配段落
		if snippet == "" && r.Content != "" {
			snippet = s.extractSnippet(content, query, 150)
		}
		nodeChunks = append(nodeChunks, &domain.NodeContentChunk{
			ID:           r.DocID,
			Content:      content,
			DocID:        r.DocID,
			MatchSnippet: snippet,
		})
	}

	return query, nodeChunks, nil
}

func normalizeSearchText(content string) string {
	if content == "" {
		return ""
	}
	cleaned := stdhtml.UnescapeString(content)
	cleaned = htmlImagePattern.ReplaceAllString(cleaned, " ")
	cleaned = markdownImagePattern.ReplaceAllString(cleaned, " ")
	cleaned = dataImagePattern.ReplaceAllString(cleaned, " ")
	cleaned = urlPattern.ReplaceAllString(cleaned, " ")
	cleaned = htmlTagPattern.ReplaceAllString(cleaned, " ")
	cleaned = whitespacePattern.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

// extractSnippet 从 content 中提取包含 query 的段落片段
func (s *PgFTSRAG) extractSnippet(content, query string, maxLen int) string {
	lowerContent := strings.ToLower(content)
	lowerQuery := strings.ToLower(query)
	idx := strings.Index(lowerContent, lowerQuery)
	if idx == -1 {
		// 未找到精确匹配，返回开头部分
		if len([]rune(content)) > maxLen {
			return string([]rune(content)[:maxLen]) + "..."
		}
		return content
	}

	// 以匹配位置为中心，向前后扩展
	runes := []rune(content)
	runeIdx := len([]rune(content[:idx]))
	halfWindow := maxLen / 2

	start := runeIdx - halfWindow
	if start < 0 {
		start = 0
	}
	end := start + maxLen
	if end > len(runes) {
		end = len(runes)
		start = end - maxLen
		if start < 0 {
			start = 0
		}
	}

	snippet := string(runes[start:end])
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(runes) {
		snippet = snippet + "..."
	}
	return snippet
}

func (s *PgFTSRAG) UpsertRecords(ctx context.Context, req *UpsertRecordsRequest) (string, error) {
	// FTS 模式下，文档内容已经存储在 node_releases 表中
	// search_vector 由数据库触发器自动更新
	// 这里只需要确保 doc_id 存在即可
	docID := req.DocID
	if docID == "" {
		docID = req.ID
	}
	s.logger.Info("PgFTSRAG: upsert records (handled by DB trigger)",
		log.String("doc_id", docID),
		log.String("title", req.Title))
	return docID, nil
}

func (s *PgFTSRAG) DeleteRecords(ctx context.Context, datasetID string, docIDs []string) error {
	// FTS 模式下，删除 node_releases 记录时 search_vector 自动清除
	s.logger.Info("PgFTSRAG: delete records (handled by cascade)",
		log.Int("doc_count", len(docIDs)))
	return nil
}

func (s *PgFTSRAG) DeleteKnowledgeBase(ctx context.Context, datasetID string) error {
	// FTS 模式下无需额外操作
	return nil
}

func (s *PgFTSRAG) UpdateDocumentGroupIDs(ctx context.Context, datasetID string, docID string, groupIds []int) error {
	// FTS 模式下权限通过 node_auth_groups 表管理，无需额外操作
	return nil
}

func (s *PgFTSRAG) ListDocuments(ctx context.Context, datasetID string, documentIDs []string) ([]Document, error) {
	if len(documentIDs) == 0 {
		return nil, nil
	}

	type nodeReleaseDoc struct {
		DocID  string `gorm:"column:doc_id"`
		Name   string `gorm:"column:name"`
		NodeID string `gorm:"column:node_id"`
	}

	var docs []nodeReleaseDoc
	if err := s.db.WithContext(ctx).
		Table("node_releases").
		Select("COALESCE(NULLIF(doc_id, ''), id) AS doc_id, name, node_id").
		Where("COALESCE(NULLIF(doc_id, ''), id) IN ?", documentIDs).
		Find(&docs).Error; err != nil {
		return nil, err
	}

	documents := lo.Map(docs, func(d nodeReleaseDoc, _ int) Document {
		return Document{
			ID:        d.DocID,
			Name:      d.Name,
			DatasetID: datasetID,
			Status:    "completed",
		}
	})

	return documents, nil
}

// 模型管理方法 - FTS 模式下不需要管理外部模型，但需要实现接口
func (s *PgFTSRAG) GetModelList(ctx context.Context) ([]*domain.Model, error) {
	return nil, nil
}

func (s *PgFTSRAG) AddModel(ctx context.Context, model *domain.Model) (string, error) {
	return uuid.New().String(), nil
}

func (s *PgFTSRAG) UpdateModel(ctx context.Context, model *domain.Model) error {
	return nil
}

func (s *PgFTSRAG) UpsertModel(ctx context.Context, model *domain.Model) error {
	return nil
}

func (s *PgFTSRAG) DeleteModel(ctx context.Context, model *domain.Model) error {
	return nil
}
