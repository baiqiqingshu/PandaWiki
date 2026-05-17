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
WIKI_SITE_PORT="${WIKI_SITE_PORT:-8005}"
echo "Wiki 前台站点端口: ${WIKI_SITE_PORT}"

# 尝试从 PostgreSQL 获取第一个知识库 ID
KB_ID=""
if command -v psql >/dev/null 2>&1 || apk add --no-cache postgresql-client >/dev/null 2>&1; then
    # 解析 PG_DSN 获取连接信息
    PG_HOST=$(echo "$PG_DSN" | sed -n 's/.*host=\([^ ]*\).*/\1/p')
    PG_USER=$(echo "$PG_DSN" | sed -n 's/.*user=\([^ ]*\).*/\1/p')
    PG_PASS=$(echo "$PG_DSN" | sed -n 's/.*password=\([^ ]*\).*/\1/p')
    PG_DB=$(echo "$PG_DSN" | sed -n 's/.*dbname=\([^ ]*\).*/\1/p')
    PG_PORT=$(echo "$PG_DSN" | sed -n 's/.*port=\([^ ]*\).*/\1/p')

    export PGPASSWORD="$PG_PASS"
    KB_ID=$(psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -p "${PG_PORT:-5432}" -t -A \
        -c "SELECT id FROM knowledge_bases ORDER BY created_at ASC LIMIT 1" 2>/dev/null || true)
    unset PGPASSWORD
fi

if [ -n "$KB_ID" ]; then
    echo "从数据库获取到 KB ID: ${KB_ID}"
    export WIKI_KB_ID="$KB_ID"
else
    echo "未获取到 KB ID（知识库可能尚未创建），使用占位符"
    export WIKI_KB_ID="__PENDING__"
fi

# 从模板生成 wiki 站点 Nginx 配置
if [ -f /app/wiki-site.conf.template ]; then
    envsubst '${WIKI_SITE_PORT} ${WIKI_KB_ID}' < /app/wiki-site.conf.template > /etc/nginx/conf.d/wiki-site.conf
    echo "Wiki 站点 Nginx 配置已生成 (端口: ${WIKI_SITE_PORT}, KB: ${WIKI_KB_ID})"
fi

# 如果 KB ID 是占位符，创建后台脚本在 API 启动后更新
if [ "$WIKI_KB_ID" = "__PENDING__" ]; then
    cat > /app/wiki-site-init.sh << 'INITEOF'
#!/bin/sh
# 等待知识库创建（自动初始化会在 API 启动后执行）
echo "[wiki-site-init] 等待知���库创建..."
MAX_WAIT=120
WAITED=0
KB_ID=""

while [ $WAITED -lt $MAX_WAIT ] && [ -z "$KB_ID" ]; do
    sleep 5
    WAITED=$((WAITED + 5))

    # 尝试从 PostgreSQL 获取
    PG_HOST=$(echo "$PG_DSN" | sed -n 's/.*host=\([^ ]*\).*/\1/p')
    PG_USER=$(echo "$PG_DSN" | sed -n 's/.*user=\([^ ]*\).*/\1/p')
    PG_PASS=$(echo "$PG_DSN" | sed -n 's/.*password=\([^ ]*\).*/\1/p')
    PG_DB=$(echo "$PG_DSN" | sed -n 's/.*dbname=\([^ ]*\).*/\1/p')
    PG_PORT=$(echo "$PG_DSN" | sed -n 's/.*port=\([^ ]*\).*/\1/p')

    export PGPASSWORD="$PG_PASS"
    KB_ID=$(psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -p "${PG_PORT:-5432}" -t -A \
        -c "SELECT id FROM knowledge_bases ORDER BY created_at ASC LIMIT 1" 2>/dev/null || true)
    unset PGPASSWORD
done

if [ -n "$KB_ID" ]; then
    echo "[wiki-site-init] 获取到 KB ID: ${KB_ID}"
    sed -i "s/__PENDING__/${KB_ID}/g" /etc/nginx/conf.d/wiki-site.conf
    nginx -s reload 2>/dev/null || true
    echo "[wiki-site-init] Nginx 已重载，Wiki 前台就绪"
else
    echo "[wiki-site-init] 警告: ${MAX_WAIT}s 内未获取到 KB ID"
fi
INITEOF
    chmod +x /app/wiki-site-init.sh
    # 后台延迟执行
    (sleep 10 && /app/wiki-site-init.sh) &
fi

# 启动所有服务
echo "启动所有服务..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
