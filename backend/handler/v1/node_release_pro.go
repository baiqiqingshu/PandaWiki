package v1

import (
	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	pgRepo "github.com/chaitin/panda-wiki/repo/pg"
)

// NodeReleaseProHandler 为开源版补齐前端期望的 /api/pro/v1/node/release/* 只读接口
type NodeReleaseProHandler struct {
	*handler.BaseHandler
	logger   *log.Logger
	nodeRepo *pgRepo.NodeRepository
	auth     middleware.AuthMiddleware
}

func NewNodeReleaseProHandler(
	baseHandler *handler.BaseHandler,
	echo *echo.Echo,
	nodeRepo *pgRepo.NodeRepository,
	auth middleware.AuthMiddleware,
	logger *log.Logger,
) *NodeReleaseProHandler {
	h := &NodeReleaseProHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.node_release_pro"),
		nodeRepo:    nodeRepo,
		auth:        auth,
	}

	group := echo.Group(
		"/api/pro/v1/node/release",
		h.auth.Authorize,
		h.auth.ValidateKBUserPerm(consts.UserKBPermissionDocManage),
	)
	group.GET("/list", h.List)
	group.GET("/detail", h.Detail)
	return h
}

func (h *NodeReleaseProHandler) List(c echo.Context) error {
	var req domain.GetProNodeReleaseListReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request params invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request params failed", err)
	}

	items, err := h.nodeRepo.ListProNodeReleases(c.Request().Context(), req.KBID, req.NodeID)
	if err != nil {
		return h.NewResponseWithError(c, "failed to list node releases", err)
	}
	return h.NewResponseWithData(c, items)
}

func (h *NodeReleaseProHandler) Detail(c echo.Context) error {
	var req domain.GetProNodeReleaseDetailReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request params invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request params failed", err)
	}

	detail, err := h.nodeRepo.GetProNodeReleaseDetail(c.Request().Context(), req.KBID, req.ID)
	if err != nil {
		return h.NewResponseWithError(c, "failed to get node release detail", err)
	}
	return h.NewResponseWithData(c, detail)
}
