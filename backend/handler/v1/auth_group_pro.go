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

// AuthGroupProHandler 为开源版补齐前端期望的 /api/pro/v1/auth/group/list 只读接口
type AuthGroupProHandler struct {
	*handler.BaseHandler
	logger   *log.Logger
	authRepo *pgRepo.AuthRepo
	auth     middleware.AuthMiddleware
}

func NewAuthGroupProHandler(
	baseHandler *handler.BaseHandler,
	echo *echo.Echo,
	authRepo *pgRepo.AuthRepo,
	auth middleware.AuthMiddleware,
	logger *log.Logger,
) *AuthGroupProHandler {
	h := &AuthGroupProHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.auth_group_pro"),
		authRepo:    authRepo,
		auth:        auth,
	}

	group := echo.Group(
		"/api/pro/v1/auth/group",
		h.auth.Authorize,
		h.auth.ValidateKBUserPerm(consts.UserKBPermissionDocManage),
	)
	group.GET("/list", h.List)
	return h
}

func (h *AuthGroupProHandler) List(c echo.Context) error {
	var req domain.GetProAuthGroupListReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request params invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request params failed", err)
	}

	groups, total, err := h.authRepo.ListAuthGroupsByKB(c.Request().Context(), req.KBID, req.Page, req.PageSize)
	if err != nil {
		return h.NewResponseWithError(c, "failed to list auth groups", err)
	}

	items := make([]domain.ProAuthGroupListItem, 0, len(groups))
	for _, g := range groups {
		parentID := uint(0)
		if g.ParentID != nil {
			parentID = *g.ParentID
		}
		authIDs := make([]int64, 0, len(g.AuthIDs))
		for _, id := range g.AuthIDs {
			authIDs = append(authIDs, id)
		}
		items = append(items, domain.ProAuthGroupListItem{
			ID:        g.ID,
			Name:      g.Name,
			ParentID:  parentID,
			Position:  g.Position,
			AuthIDs:   authIDs,
			Count:     len(authIDs),
			CreatedAt: g.CreatedAt,
		})
	}
	return h.NewResponseWithData(c, domain.ProAuthGroupListResp{
		List:  items,
		Total: total,
	})
}
