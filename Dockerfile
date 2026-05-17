# ============================================================
# PandaWiki 单镜像构建 (All-in-One)
# 包含: Go API + Consumer + Migrate + Admin (nginx) + App (Next.js)
# ============================================================

# ---- Stage 1: 构建 Go 后端 ----
FROM golang:1.24.3-alpine AS go-builder

WORKDIR /src
ENV CGO_ENABLED=0

COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY backend/ .

ARG VERSION=latest
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go build -ldflags "-s -w -extldflags '-static' -X github.com/chaitin/panda-wiki/telemetry.Version=${VERSION}" \
      -o /build/panda-wiki-api cmd/api/main.go cmd/api/wire_gen.go \
    && go build -ldflags "-s -w -extldflags '-static' -X github.com/chaitin/panda-wiki/telemetry.Version=${VERSION}" \
      -o /build/panda-wiki-consumer cmd/consumer/main.go cmd/consumer/wire_gen.go \
    && go build -ldflags "-s -w -extldflags '-static' -X github.com/chaitin/panda-wiki/telemetry.Version=${VERSION}" \
      -o /build/panda-wiki-migrate cmd/migrate/main.go cmd/migrate/wire_gen.go

# ---- Stage 2: 构建前端 ----
FROM node:22-alpine AS web-builder

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
COPY web/packages/ ./packages/
COPY web/admin/package.json ./admin/package.json
COPY web/app/package.json ./app/package.json

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

COPY web/admin/ ./admin/
COPY web/app/ ./app/
COPY web/prettier.config.js web/tsconfig.base.json ./

# 并行构建 admin 和 app
RUN pnpm --parallel --filter panda-wiki-admin --filter panda-wiki-app build

# ---- Stage 3: 最终运行镜像 ----
FROM node:22-alpine AS runtime

RUN apk update \
    && apk upgrade \
    && apk add --no-cache \
       ca-certificates tzdata nginx supervisor \
    && update-ca-certificates 2>/dev/null || true \
    && rm -rf /var/cache/apk/* \
    && mkdir -p /var/log/supervisor /app/run

WORKDIR /app

# --- 复制 Go 二进制 ---
COPY --from=go-builder /build/panda-wiki-api /app/panda-wiki-api
COPY --from=go-builder /build/panda-wiki-consumer /app/panda-wiki-consumer
COPY --from=go-builder /build/panda-wiki-migrate /app/panda-wiki-migrate
COPY --from=go-builder /src/store/pg/migration /app/migration

# --- 复制 Admin 静态文件 ---
COPY --from=web-builder /web/admin/dist /app/admin-dist

# --- 复制 App (Next.js standalone) ---
COPY --from=web-builder /web/app/public /app/next-app/public
COPY --from=web-builder /web/app/dist/standalone/ /app/next-app/
COPY --from=web-builder /web/app/dist/static /app/next-app/app/dist/static

# --- Nginx 配置 ---
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

# --- SSL 证书目录 (运行时生成) ---
RUN mkdir -p /etc/nginx/ssl

# --- Supervisord 配置 ---
COPY deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# --- 启动脚本 ---
COPY deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
