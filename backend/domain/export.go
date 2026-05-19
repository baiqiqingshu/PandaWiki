package domain

import "time"

// ExportReq 批量导出请求
type ExportReq struct {
	KBID          string `json:"kb_id" validate:"required"`
	NavID         string `json:"nav_id" validate:"required"`
	Format        string `json:"format"`          // "markdown" | "html"
	IncludeAssets bool   `json:"include_assets"`
}

// ImportReq 导入请求
type ImportReq struct {
	KBID             string `json:"kb_id" validate:"required"`
	NavID            string `json:"nav_id"`
	ConflictStrategy string `json:"conflict_strategy"` // skip | overwrite | rename
}

// ExportManifest 导出清单
type ExportManifest struct {
	Version      string          `json:"version"`
	ExportFormat string          `json:"export_format"`
	KBID         string          `json:"kb_id"`
	KBName       string          `json:"kb_name"`
	ExportedAt   time.Time       `json:"exported_at"`
	ExportedBy   string          `json:"exported_by"`
	NavList      []ExportNavItem `json:"nav_list"`
	NodeCount    int             `json:"node_count"`
	TotalAssets  int             `json:"total_assets"`
}

// ExportNavItem 导出的导航项
type ExportNavItem struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Position float64 `json:"position"`
}

// ExportNodeMeta 导出的文档元信息
type ExportNodeMeta struct {
	ID             string          `json:"id"`
	KBID           string          `json:"kb_id"`
	NavID          string          `json:"nav_id"`
	ParentID       string          `json:"parent_id"`
	Type           NodeType        `json:"type"`
	Name           string          `json:"name"`
	Emoji          string          `json:"emoji"`
	Summary        string          `json:"summary"`
	ContentType    string          `json:"content_type"`
	Position       float64         `json:"position"`
	CreatorID      string          `json:"creator_id"`
	CreatorAccount string          `json:"creator_account"`
	EditorID       string          `json:"editor_id"`
	EditorAccount  string          `json:"editor_account"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	Permissions    NodePermissions `json:"permissions"`
}

// ImportResult 导入结果
type ImportResult struct {
	ImportedCount int                `json:"imported_count"`
	SkippedCount  int                `json:"skipped_count"`
	FailedCount   int                `json:"failed_count"`
	Details       []ImportNodeResult `json:"details"`
	NodeIDs       []string           `json:"node_ids"`
}

// ImportNodeResult 单个节点导入结果
type ImportNodeResult struct {
	Name   string `json:"name"`
	Status string `json:"status"` // imported | skipped | failed
	Reason string `json:"reason,omitempty"`
}
