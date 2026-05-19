package v1

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type ExportHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.ExportUsecase
	auth    middleware.AuthMiddleware
}

func NewExportHandler(
	baseHandler *handler.BaseHandler,
	echo *echo.Echo,
	usecase *usecase.ExportUsecase,
	auth middleware.AuthMiddleware,
	logger *log.Logger,
) *ExportHandler {
	h := &ExportHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.export"),
		usecase:     usecase,
		auth:        auth,
	}

	group := echo.Group("/api/v1/node", h.auth.Authorize, h.auth.ValidateKBUserPerm(consts.UserKBPermissionDocManage))
	group.POST("/export", h.ExportNodes)
	group.POST("/import", h.ImportNodes)

	return h
}

// ExportNodes 批量导出文档
//
//	@Summary		Export Nodes
//	@Description	Export all nodes under a nav as zip
//	@Tags			node
//	@Accept			json
//	@Produce		application/zip
//	@Security		bearerAuth
//	@Param			body	body	domain.ExportReq	true	"Export Request"
//	@Success		200		{file}	file
//	@Router			/api/v1/node/export [post]
func (h *ExportHandler) ExportNodes(c echo.Context) error {
	ctx := c.Request().Context()
	authInfo := domain.GetAuthInfoFromCtx(ctx)
	if authInfo == nil {
		return h.NewResponseWithError(c, "authInfo not found in context", nil)
	}

	req := &domain.ExportReq{}
	if err := c.Bind(req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}

	reader, filename, err := h.usecase.Export(ctx, req, authInfo.UserId)
	if err != nil {
		h.logger.Error("export nodes failed", log.Error(err))
		return h.NewResponseWithError(c, "export nodes failed", err)
	}

	c.Response().Header().Set("Content-Type", "application/zip")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Response().WriteHeader(http.StatusOK)

	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			c.Response().Write(buf[:n])
		}
		if err != nil {
			break
		}
	}
	return nil
}

// ImportNodes 批量导入文档
//
//	@Summary		Import Nodes
//	@Description	Import nodes from zip file
//	@Tags			node
//	@Accept			multipart/form-data
//	@Produce		json
//	@Security		bearerAuth
//	@Param			file				formData	file	true	"Zip file"
//	@Param			kb_id				formData	string	true	"Knowledge Base ID"
//	@Param			nav_id				formData	string	false	"Target Nav ID"
//	@Param			conflict_strategy	formData	string	false	"Conflict strategy: skip/overwrite/rename"
//	@Success		200					{object}	domain.PWResponse{data=domain.ImportResult}
//	@Router			/api/v1/node/import [post]
func (h *ExportHandler) ImportNodes(c echo.Context) error {
	ctx := c.Request().Context()
	authInfo := domain.GetAuthInfoFromCtx(ctx)
	if authInfo == nil {
		return h.NewResponseWithError(c, "authInfo not found in context", nil)
	}

	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		return h.NewResponseWithError(c, "file is required", err)
	}

	src, err := file.Open()
	if err != nil {
		return h.NewResponseWithError(c, "open file failed", err)
	}
	defer src.Close()

	req := &domain.ImportReq{
		KBID:             c.FormValue("kb_id"),
		NavID:            c.FormValue("nav_id"),
		ConflictStrategy: c.FormValue("conflict_strategy"),
	}

	if req.KBID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}

	result, err := h.usecase.Import(ctx, req, src, file.Size, authInfo.UserId)
	if err != nil {
		h.logger.Error("import nodes failed", log.Error(err))
		return h.NewResponseWithError(c, "import nodes failed", err)
	}

	return h.NewResponseWithData(c, result)
}
