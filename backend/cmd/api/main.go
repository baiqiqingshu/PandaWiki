package main

import (
	"fmt"

	"github.com/chaitin/panda-wiki/setup"
)

// @title panda-wiki API
// @version 1.0
// @description panda-wiki API documentation
// @BasePath /
// @securityDefinitions.apikey	bearerAuth
// @in	header
// @name	Authorization
// @description	Type "Bearer" + a space + your token to authorize
func main() {
	app, err := createApp()
	if err != nil {
		panic(err)
	}
	if err := setup.CheckInitCert(); err != nil {
		panic(err)
	}

	// 启动时自动初始化知识库站点（从 WIKI_NAME / WIKI_SITE_PORT 环境变量读取）
	if err := setup.AutoInitKnowledgeBase(app.DB, app.RAGService, app.Config, app.Logger); err != nil {
		app.Logger.Error(fmt.Sprintf("auto init knowledge base failed: %v", err))
		// 不 panic，让服务正常启动
	}

	port := app.Config.HTTP.Port
	app.Logger.Info(fmt.Sprintf("Starting server on port %d", port))
	app.HTTPServer.Echo.Logger.Fatal(app.HTTPServer.Echo.Start(fmt.Sprintf(":%d", port)))
}

