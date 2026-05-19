package usecase

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/store/s3"
)

var s3URLRegex = regexp.MustCompile(`(https?://[^/]+/static-file/[^\s)"\]]+)`)

type ExportUsecase struct {
	nodeRepo *pg.NodeRepository
	navRepo  *pg.NavRepository
	kbRepo   *pg.KnowledgeBaseRepository
	userRepo *pg.UserRepository
	s3Client *s3.MinioClient
	logger   *log.Logger
}

func NewExportUsecase(
	nodeRepo *pg.NodeRepository,
	navRepo *pg.NavRepository,
	kbRepo *pg.KnowledgeBaseRepository,
	userRepo *pg.UserRepository,
	s3Client *s3.MinioClient,
	logger *log.Logger,
) *ExportUsecase {
	return &ExportUsecase{
		nodeRepo: nodeRepo,
		navRepo:  navRepo,
		kbRepo:   kbRepo,
		userRepo: userRepo,
		s3Client: s3Client,
		logger:   logger.WithModule("usecase.export"),
	}
}

// Export 批量导出指定 Nav 目录下的所有文档
func (u *ExportUsecase) Export(ctx context.Context, req *domain.ExportReq, userAccount string) (io.Reader, string, error) {
	// 1. 查询知识库信息
	kb, err := u.kbRepo.GetKnowledgeBaseByID(ctx, req.KBID)
	if err != nil {
		return nil, "", fmt.Errorf("get knowledge base failed: %w", err)
	}

	// 2. 查询导航信息
	nav, err := u.navRepo.GetById(ctx, req.NavID)
	if err != nil {
		return nil, "", fmt.Errorf("get nav failed: %w", err)
	}

	// 3. 获取该 Nav 下所有节点
	nodes, err := u.nodeRepo.GetNodesByNavID(ctx, req.KBID, req.NavID)
	if err != nil {
		return nil, "", fmt.Errorf("get nodes failed: %w", err)
	}

	// 4. 获取用户信息映射
	userMap, err := u.userRepo.GetUsersAccountMap(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("get user map failed: %w", err)
	}

	// 5. 确定导出格式
	format := req.Format
	if format == "" {
		format = "markdown"
	}

	// 6. 构建节点树（用于生成目录路径）
	nodeMap := make(map[string]*domain.Node)
	for _, node := range nodes {
		nodeMap[node.ID] = node
	}

	// 7. 创建 zip
	buf := &bytes.Buffer{}
	zipWriter := zip.NewWriter(buf)

	assetCount := 0
	nodeCount := 0
	navDirName := sanitizeFilename(nav.Name)

	for _, node := range nodes {
		// 构建文件路径
		dirPath := u.buildExportPath(node, nodeMap, navDirName)

		if node.Type == domain.NodeTypeFolder {
			// 文件夹节点：创建目录并写入 meta
			meta := u.buildNodeMeta(node, userMap)
			metaJSON, _ := json.MarshalIndent(meta, "", "  ")
			metaPath := filepath.Join(dirPath, "_folder.meta.json")
			metaPath = filepath.ToSlash(metaPath)
			w, err := zipWriter.Create(metaPath)
			if err != nil {
				u.logger.Error("create zip entry failed", log.Error(err))
				continue
			}
			w.Write(metaJSON)
			nodeCount++
			continue
		}

		// 文档节点
		nodeCount++
		safeName := sanitizeFilename(node.Name)

		// 写入文档内容
		content := node.Content
		var assetFiles []assetFile

		// 处理图片
		if req.IncludeAssets {
			content, assetFiles = u.extractAndReplaceAssets(ctx, content, dirPath)
			for _, af := range assetFiles {
				assetPath := filepath.ToSlash(filepath.Join(dirPath, "assets", af.filename))
				w, err := zipWriter.Create(assetPath)
				if err != nil {
					u.logger.Error("create asset zip entry failed", log.Error(err))
					continue
				}
				w.Write(af.data)
				assetCount++
			}
		}

		// 写入文档文件
		ext := ".md"
		if format == "html" {
			ext = ".html"
		}
		docPath := filepath.ToSlash(filepath.Join(dirPath, safeName+ext))
		w, err := zipWriter.Create(docPath)
		if err != nil {
			u.logger.Error("create doc zip entry failed", log.Error(err))
			continue
		}
		w.Write([]byte(content))

		// 写入元信息
		meta := u.buildNodeMeta(node, userMap)
		metaJSON, _ := json.MarshalIndent(meta, "", "  ")
		metaPath := filepath.ToSlash(filepath.Join(dirPath, safeName+".meta.json"))
		w2, err := zipWriter.Create(metaPath)
		if err != nil {
			u.logger.Error("create meta zip entry failed", log.Error(err))
			continue
		}
		w2.Write(metaJSON)
	}

	// 8. 写入 manifest.json
	manifest := domain.ExportManifest{
		Version:      "1.0",
		ExportFormat: format,
		KBID:         req.KBID,
		KBName:       kb.Name,
		ExportedAt:   time.Now(),
		ExportedBy:   userAccount,
		NavList: []domain.ExportNavItem{
			{
				ID:       nav.ID,
				Name:     nav.Name,
				Position: nav.Position,
			},
		},
		NodeCount:   nodeCount,
		TotalAssets: assetCount,
	}
	manifestJSON, _ := json.MarshalIndent(manifest, "", "  ")
	w, err := zipWriter.Create("manifest.json")
	if err != nil {
		return nil, "", fmt.Errorf("create manifest entry failed: %w", err)
	}
	w.Write(manifestJSON)

	if err := zipWriter.Close(); err != nil {
		return nil, "", fmt.Errorf("close zip writer failed: %w", err)
	}

	filename := fmt.Sprintf("export_%s_%s.zip", sanitizeFilename(kb.Name), time.Now().Format("20060102_150405"))
	return bytes.NewReader(buf.Bytes()), filename, nil
}

// Import 批量导入 zip 文件
func (u *ExportUsecase) Import(ctx context.Context, req *domain.ImportReq, file io.Reader, fileSize int64, userId string) (*domain.ImportResult, error) {
	// 1. 读取 zip 内容
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read file failed: %w", err)
	}

	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip failed: %w", err)
	}

	// 2. 读取 manifest
	var manifest domain.ExportManifest
	for _, f := range zipReader.File {
		if f.Name == "manifest.json" {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("open manifest failed: %w", err)
			}
			if err := json.NewDecoder(rc).Decode(&manifest); err != nil {
				rc.Close()
				return nil, fmt.Errorf("decode manifest failed: %w", err)
			}
			rc.Close()
			break
		}
	}
	if manifest.Version == "" {
		return nil, fmt.Errorf("invalid zip: manifest.json not found or invalid")
	}

	// 3. 确定目标 Nav
	targetNavID := req.NavID
	if targetNavID == "" && len(manifest.NavList) > 0 {
		// 使用 manifest 中的第一个 nav，如果不存在则创建
		targetNavID = manifest.NavList[0].ID
		// 验证 nav 是否存在
		_, err := u.navRepo.GetById(ctx, targetNavID)
		if err != nil {
			// Nav 不存在，使用 kb 的第一个 nav
			navs, err := u.navRepo.GetList(ctx, req.KBID)
			if err != nil || len(navs) == 0 {
				return nil, fmt.Errorf("no available nav found")
			}
			targetNavID = navs[0].ID
		}
	}
	if targetNavID == "" {
		navs, err := u.navRepo.GetList(ctx, req.KBID)
		if err != nil || len(navs) == 0 {
			return nil, fmt.Errorf("no available nav found")
		}
		targetNavID = navs[0].ID
	}

	// 4. 解析 zip 中的文件结构
	// 收集所有 meta 文件和内容文件
	metaFiles := make(map[string][]byte)   // path -> meta json bytes
	contentFiles := make(map[string][]byte) // path -> content bytes
	assetFiles := make(map[string][]byte)   // path -> asset bytes

	for _, f := range zipReader.File {
		if f.Name == "manifest.json" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			continue
		}
		fileData, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			continue
		}

		if strings.HasSuffix(f.Name, ".meta.json") {
			metaFiles[f.Name] = fileData
		} else if strings.Contains(f.Name, "/assets/") {
			assetFiles[f.Name] = fileData
		} else if strings.HasSuffix(f.Name, ".md") || strings.HasSuffix(f.Name, ".html") {
			contentFiles[f.Name] = fileData
		}
	}

	// 5. 处理导入
	result := &domain.ImportResult{
		Details: make([]domain.ImportNodeResult, 0),
		NodeIDs: make([]string, 0),
	}

	conflictStrategy := req.ConflictStrategy
	if conflictStrategy == "" {
		conflictStrategy = "skip"
	}

	// 获取现有节点名称用于冲突检测
	existingNodes, err := u.nodeRepo.GetNodesByNavID(ctx, req.KBID, targetNavID)
	if err != nil {
		return nil, fmt.Errorf("get existing nodes failed: %w", err)
	}
	existingNameMap := make(map[string]*domain.Node)
	for _, n := range existingNodes {
		key := n.ParentID + "/" + n.Name
		existingNameMap[key] = n
	}

	// 按 meta 文件处理导入
	// 先处理文件夹，再处理文档
	type importItem struct {
		meta    *domain.ExportNodeMeta
		content []byte
	}

	folders := make([]*importItem, 0)
	documents := make([]*importItem, 0)

	for metaPath, metaData := range metaFiles {
		var meta domain.ExportNodeMeta
		if err := json.Unmarshal(metaData, &meta); err != nil {
			result.FailedCount++
			result.Details = append(result.Details, domain.ImportNodeResult{
				Name:   metaPath,
				Status: "failed",
				Reason: "invalid meta json",
			})
			continue
		}

		item := &importItem{meta: &meta}

		if meta.Type == domain.NodeTypeFolder {
			folders = append(folders, item)
		} else {
			// 查找对应的内容文件
			dir := filepath.Dir(metaPath)
			baseName := strings.TrimSuffix(filepath.Base(metaPath), ".meta.json")
			// 尝试 .md 和 .html
			contentPath := filepath.ToSlash(filepath.Join(dir, baseName+".md"))
			if content, ok := contentFiles[contentPath]; ok {
				item.content = content
			} else {
				contentPath = filepath.ToSlash(filepath.Join(dir, baseName+".html"))
				if content, ok := contentFiles[contentPath]; ok {
					item.content = content
				}
			}
			documents = append(documents, item)
		}
	}

	// 旧ID -> 新ID 映射（用于还原父子关系）
	idMapping := make(map[string]string)

	// 先创建文件夹
	for _, item := range folders {
		newID, err := u.importNode(ctx, item.meta, nil, req.KBID, targetNavID, userId, idMapping, existingNameMap, conflictStrategy, assetFiles)
		if err != nil {
			result.FailedCount++
			result.Details = append(result.Details, domain.ImportNodeResult{
				Name:   item.meta.Name,
				Status: "failed",
				Reason: err.Error(),
			})
			continue
		}
		if newID == "" {
			result.SkippedCount++
			result.Details = append(result.Details, domain.ImportNodeResult{
				Name:   item.meta.Name,
				Status: "skipped",
				Reason: "already exists",
			})
			continue
		}
		idMapping[item.meta.ID] = newID
		result.ImportedCount++
		result.NodeIDs = append(result.NodeIDs, newID)
		result.Details = append(result.Details, domain.ImportNodeResult{
			Name:   item.meta.Name,
			Status: "imported",
		})
	}

	// 再创建文档
	for _, item := range documents {
		newID, err := u.importNode(ctx, item.meta, item.content, req.KBID, targetNavID, userId, idMapping, existingNameMap, conflictStrategy, assetFiles)
		if err != nil {
			result.FailedCount++
			result.Details = append(result.Details, domain.ImportNodeResult{
				Name:   item.meta.Name,
				Status: "failed",
				Reason: err.Error(),
			})
			continue
		}
		if newID == "" {
			result.SkippedCount++
			result.Details = append(result.Details, domain.ImportNodeResult{
				Name:   item.meta.Name,
				Status: "skipped",
				Reason: "already exists",
			})
			continue
		}
		idMapping[item.meta.ID] = newID
		result.ImportedCount++
		result.NodeIDs = append(result.NodeIDs, newID)
		result.Details = append(result.Details, domain.ImportNodeResult{
			Name:   item.meta.Name,
			Status: "imported",
		})
	}

	return result, nil
}

func (u *ExportUsecase) importNode(
	ctx context.Context,
	meta *domain.ExportNodeMeta,
	content []byte,
	kbID, navID, userId string,
	idMapping map[string]string,
	existingNameMap map[string]*domain.Node,
	conflictStrategy string,
	assetFiles map[string][]byte,
) (string, error) {
	// 确定 parent_id
	parentID := ""
	if meta.ParentID != "" {
		if newParentID, ok := idMapping[meta.ParentID]; ok {
			parentID = newParentID
		}
	}

	// 冲突检测
	key := parentID + "/" + meta.Name
	if existing, ok := existingNameMap[key]; ok {
		switch conflictStrategy {
		case "skip":
			// 对于文件夹，仍然需要记录映射关系
			if meta.Type == domain.NodeTypeFolder {
				idMapping[meta.ID] = existing.ID
			}
			return "", nil
		case "overwrite":
			// 覆盖：更新现有节点内容
			if meta.Type == domain.NodeTypeDocument && content != nil {
				contentStr := u.processImportContent(ctx, string(content), kbID, assetFiles)
				contentPtr := &contentStr
				namePtr := &meta.Name
				err := u.nodeRepo.UpdateNodeContent(ctx, &domain.UpdateNodeReq{
					ID:      existing.ID,
					KBID:    kbID,
					Name:    namePtr,
					Content: contentPtr,
				}, userId)
				if err != nil {
					return "", err
				}
			}
			idMapping[meta.ID] = existing.ID
			return existing.ID, nil
		case "rename":
			meta.Name = meta.Name + "_imported_" + time.Now().Format("20060102150405")
		}
	}

	// 处理文档内容中的图片引用
	contentStr := ""
	if content != nil {
		contentStr = u.processImportContent(ctx, string(content), kbID, assetFiles)
	}

	// 创建节点
	position := meta.Position
	contentType := meta.ContentType
	if contentType == "" {
		contentType = "md"
	}
	summary := meta.Summary

	createReq := &domain.CreateNodeReq{
		KBID:        kbID,
		NavId:       navID,
		ParentID:    parentID,
		Type:        meta.Type,
		Name:        meta.Name,
		Content:     contentStr,
		Emoji:       meta.Emoji,
		Summary:     &summary,
		ContentType: &contentType,
		Position:    &position,
		MaxNode:     999999, // 导入时不限制
	}

	nodeID, err := u.nodeRepo.Create(ctx, createReq, userId)
	if err != nil {
		return "", fmt.Errorf("create node failed: %w", err)
	}

	return nodeID, nil
}

// processImportContent 处理导入内容中的相对路径图片引用，上传到 S3
func (u *ExportUsecase) processImportContent(ctx context.Context, content string, kbID string, assetFiles map[string][]byte) string {
	// 匹配相对路径图片引用 ./assets/xxx
	relativeAssetRegex := regexp.MustCompile(`\./assets/([^\s)"\]]+)`)
	content = relativeAssetRegex.ReplaceAllStringFunc(content, func(match string) string {
		// 提取文件名
		parts := relativeAssetRegex.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		filename := parts[1]

		// 在 assetFiles 中查找（遍历所有 asset 路径找到匹配的文件名）
		var assetData []byte
		for path, data := range assetFiles {
			if strings.HasSuffix(path, "/"+filename) || filepath.Base(path) == filename {
				assetData = data
				break
			}
		}
		if assetData == nil {
			return match
		}

		// 上传到 S3
		ext := filepath.Ext(filename)
		s3Key := fmt.Sprintf("%s/%s%s", kbID, uuid.New().String(), ext)
		_, err := u.s3Client.PutObject(ctx, domain.Bucket, s3Key, bytes.NewReader(assetData), int64(len(assetData)), minio.PutObjectOptions{})
		if err != nil {
			u.logger.Error("upload asset to s3 failed", log.Error(err))
			return match
		}

		return fmt.Sprintf("/static-file/%s", s3Key)
	})

	return content
}

// buildExportPath 构建导出文件的目录路径
func (u *ExportUsecase) buildExportPath(node *domain.Node, nodeMap map[string]*domain.Node, navDirName string) string {
	parts := []string{navDirName}

	// 向上遍历父节点构建路径
	current := node
	pathParts := []string{}
	for current.ParentID != "" {
		parent, ok := nodeMap[current.ParentID]
		if !ok {
			break
		}
		if parent.Type == domain.NodeTypeFolder {
			pathParts = append([]string{sanitizeFilename(parent.Name)}, pathParts...)
		}
		current = parent
	}

	parts = append(parts, pathParts...)
	return filepath.ToSlash(filepath.Join(parts...))
}

// buildNodeMeta 构建节点元信息
func (u *ExportUsecase) buildNodeMeta(node *domain.Node, userMap map[string]string) *domain.ExportNodeMeta {
	creatorAccount := ""
	if account, ok := userMap[node.CreatorId]; ok {
		creatorAccount = account
	}
	editorAccount := ""
	if account, ok := userMap[node.EditorId]; ok {
		editorAccount = account
	}

	return &domain.ExportNodeMeta{
		ID:             node.ID,
		KBID:           node.KBID,
		NavID:          node.NavId,
		ParentID:       node.ParentID,
		Type:           node.Type,
		Name:           node.Name,
		Emoji:          node.Meta.Emoji,
		Summary:        node.Meta.Summary,
		ContentType:    node.Meta.ContentType,
		Position:       node.Position,
		CreatorID:      node.CreatorId,
		CreatorAccount: creatorAccount,
		EditorID:       node.EditorId,
		EditorAccount:  editorAccount,
		CreatedAt:      node.CreatedAt,
		UpdatedAt:      node.UpdatedAt,
		Permissions:    node.Permissions,
	}
}

type assetFile struct {
	filename string
	data     []byte
}

// extractAndReplaceAssets 提取文档中的 S3 图片 URL，下载并替换为相对路径
func (u *ExportUsecase) extractAndReplaceAssets(ctx context.Context, content string, dirPath string) (string, []assetFile) {
	assets := make([]assetFile, 0)
	seen := make(map[string]string) // url -> relative path

	content = s3URLRegex.ReplaceAllStringFunc(content, func(url string) string {
		if relPath, ok := seen[url]; ok {
			return relPath
		}

		// 从 URL 中提取 object key
		// URL 格式: http://panda-wiki-minio:9000/static-file/<kb_id>/<uuid>.<ext>
		parts := strings.SplitN(url, "/static-file/", 2)
		if len(parts) != 2 {
			return url
		}
		objectKey := parts[1]
		filename := filepath.Base(objectKey)

		// 从 MinIO 下载
		obj, err := u.s3Client.GetObject(ctx, domain.Bucket, objectKey, minio.GetObjectOptions{})
		if err != nil {
			u.logger.Error("download asset from s3 failed", log.String("key", objectKey), log.Error(err))
			return url
		}
		data, err := io.ReadAll(obj)
		obj.Close()
		if err != nil {
			u.logger.Error("read asset data failed", log.String("key", objectKey), log.Error(err))
			return url
		}

		assets = append(assets, assetFile{
			filename: filename,
			data:     data,
		})

		relPath := "./assets/" + filename
		seen[url] = relPath
		return relPath
	})

	return content, assets
}

// sanitizeFilename 清理文件名中的特殊字符
func sanitizeFilename(name string) string {
	// 替换不安全的文件名字符
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
	)
	result := replacer.Replace(name)
	if result == "" {
		result = "untitled"
	}
	// 限制长度
	if len(result) > 200 {
		result = result[:200]
	}
	return result
}
