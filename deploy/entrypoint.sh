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

# ---- 生成 Wiki 前台站点 Nginx 配置 (支持多端口) ----
# WIKI_SITE_PORTS: 逗号分隔的端口列表，例如 "8005,8006,8007"
# WIKI_SITE_PORT:  向后兼容的单端口变量（默认 8005）
# 优先使用 WIKI_SITE_PORTS，若未设置则回退到 WIKI_SITE_PORT
WIKI_SITE_PORT="${WIKI_SITE_PORT:-8005}"
WIKI_SITE_PORTS="${WIKI_SITE_PORTS:-$WIKI_SITE_PORT}"

echo "Wiki 前台站点端口: ${WIKI_SITE_PORTS} (KB ID 由后端动态解析)"

if [ -f /app/wiki-site.conf.template ]; then
    # 用 awk 把占位符整行替换为多行 listen 指令。
    # 直接把逗号分隔的端口列表交给 awk 拆分，避免在 sh 中拼接字面 "\n"
    # 与 awk 换行正则不匹配的问题。
    awk -v ports="$WIKI_SITE_PORTS" '
        /##LISTEN_DIRECTIVES##/ {
            n = split(ports, arr, ",")
            for (i = 1; i <= n; i++) {
                gsub(/[ \t]/, "", arr[i])
                if (arr[i] != "") printf "    listen %s;\n", arr[i]
            }
            next
        }
        { print }
    ' /app/wiki-site.conf.template > /etc/nginx/conf.d/wiki-site.conf

    echo "Wiki 站点 Nginx 配置已生成 (端口: ${WIKI_SITE_PORTS})"
fi

# 启动所有服务
echo "启动所有服务..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
