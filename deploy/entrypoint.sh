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

# 启动 supervisord 管理所有进程
echo "启动所有服务..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
