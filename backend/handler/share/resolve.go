package share

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/usecase"
)

// ShareResolveHandler 提供给 Nginx auth_request 的内部接口，
// 根据请求的 Host:Port 解析出对应的知识库 ID，通过响应头 X-KB-ID 返回。
//
// 单镜像部署模式下，Nginx 在每次进入 8005 前台请求前调用本接口，
// 使得新建/切换知识库后无需重启容器即可立即生效。
type ShareResolveHandler struct {
	*handler.BaseHandler
	logger    *log.Logger
	kbUsecase *usecase.KnowledgeBaseUsecase
}

func NewShareResolveHandler(
	e *echo.Echo,
	baseHandler *handler.BaseHandler,
	logger *log.Logger,
	kbUsecase *usecase.KnowledgeBaseUsecase,
) *ShareResolveHandler {
	h := &ShareResolveHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.share.resolve"),
		kbUsecase:   kbUsecase,
	}

	e.GET("/share/v1/resolve", h.Resolve)
	e.HEAD("/share/v1/resolve", h.Resolve)
	return h
}

// Resolve 解析当前请求归属的知识库
//
//	@Tags			share_resolve
//	@Summary		ResolveKB
//	@Description	根据 Host 和端口解析当前请求归属的知识库（供 Nginx auth_request 调用）
//	@Produce		json
//	@Success		200	{object}	map[string]string	"X-KB-ID 通过响应头返回"
//	@Failure		404	{object}	map[string]string	"未创建任何知识库"
//	@Router			/share/v1/resolve [get]
func (h *ShareResolveHandler) Resolve(c echo.Context) error {
	host, port := parseHostPort(c.Request())

	kbID, err := h.kbUsecase.ResolveKBIDByHostPort(c.Request().Context(), host, port)
	if err != nil {
		h.logger.Error("resolve kb by host/port failed",
			log.String("host", host),
			log.Int("port", port),
			log.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": "resolve kb failed",
		})
	}
	if kbID == "" {
		// 还未创建任何知识库。返回 403 而不是 404/500，
		// 因为 Nginx auth_request 只把 401/403 原样透传给客户端，
		// 其他状态码会被统一映射成 500，无法和真实后端 500 区分。
		// 这里用 403 让 wiki-site.conf 的 error_page 精准捕获“KB 不可用”状态。
		return c.JSON(http.StatusForbidden, map[string]string{
			"message": "no knowledge base available",
		})
	}

	c.Response().Header().Set("X-KB-ID", kbID)
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.JSON(http.StatusOK, map[string]string{
		"kb_id": kbID,
	})
}

// parseHostPort 从请求中提取主机名和端口。
// 优先使用 X-Forwarded-Host / X-Forwarded-Port（来自上游代理），
// 回退到 Host header；端口缺失时按协议猜测 (http=80, https=443)。
func parseHostPort(r *http.Request) (string, int) {
	hostHeader := r.Header.Get("X-Forwarded-Host")
	if hostHeader == "" {
		hostHeader = r.Host
	}

	host := hostHeader
	portStr := ""
	if idx := strings.LastIndex(hostHeader, ":"); idx != -1 && !strings.Contains(hostHeader[idx:], "]") {
		host = hostHeader[:idx]
		portStr = hostHeader[idx+1:]
	}

	if fp := r.Header.Get("X-Forwarded-Port"); fp != "" {
		portStr = fp
	}

	port, _ := strconv.Atoi(strings.TrimSpace(portStr))
	if port == 0 {
		if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
			port = 443
		} else {
			port = 80
		}
	}

	return strings.ToLower(strings.TrimSpace(host)), port
}
