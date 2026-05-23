#!/bin/sh
set -e

echo "=== PandaWiki All-in-One 启动 ==="

# 生成自签名 SSL 证书（如果不存在）
if [ ! -f /etc/nginx/ssl/panda-wiki.crt ]; then
    echo "生成自签名 SSL 证书..."
    apk add --no-cache openssl 2>/dev/null || true
    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/panda-wiki.key \
        -out /etc/nginx/ssl/panda-wiki.crt \
        -subj "/CN=panda-wiki/O=PandaWiki" 2>/dev/null
    echo "SSL 证书已生成"
fi

# 运行数据库迁移
echo "运行数据库迁移..."
/app/panda-wiki-migrate
echo "数据库迁移完成"

# ---- 生成 Wiki 前台站点 Nginx 配置 ----
# 知识库 ID 不再写死到配置里；nginx 会通过 auth_request 在每次请求前
# 调用 /share/v1/resolve 由后端按 Host:Port 动态解析，
# 这样新建/切换知识库后无需重启容器即可生效。
WIKI_SITE_PORT="${WIKI_SITE_PORT:-8005}"
echo "Wiki 前台站点端口: ${WIKI_SITE_PORT} (KB ID 由后端动态解析)"

if [ -f /app/wiki-site.conf.template ]; then
    envsubst '${WIKI_SITE_PORT}' < /app/wiki-site.conf.template > /etc/nginx/conf.d/wiki-site.conf
    echo "Wiki 站点 Nginx 配置已生成"
fi

# 启动所有服务
echo "启动所有服务..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
