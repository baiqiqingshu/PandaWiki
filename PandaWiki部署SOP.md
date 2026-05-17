# PandaWiki 空服务器部署 SOP

## 一、环境变量替换机制说明

### `${VAR:-default}` 是 Docker Compose 原生语法

`docker-compose.yml` 中的 `${POSTGRES_PASSWORD:-panda-wiki-secret}` 等**不是需要手动替换的占位符**，而是 Docker Compose 的变量插值语法：

```
${变量名:-默认值}
```

**替换时机**：执行 `docker compose up` 时，Docker Compose 自动读取**同目录下的 `.env` 文件**，将文件中的键值对注入到 `${...}` 占位符中。

**优先级**：
1. 系统环境变量（`export VAR=xxx`）
2. `.env` 文件中的值
3. `:-` 后的默认值（当变量未定义或为空时使用）

### 示例

```yaml
# docker-compose.yml
- ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
```

```env
# .env
ADMIN_PASSWORD=admin123
```

→ 运行时实际值为 `ADMIN_PASSWORD=admin123`
→ 如果 `.env` 中没有设置，则使用默认值（空字符串）

### admin/admin123 从何而来

`.env` 中配置 `ADMIN_PASSWORD=admin123` → Docker Compose 注入到容器环境变量 → Go 后端读取 `os.Getenv("ADMIN_PASSWORD")` → 调用 `UpsertDefaultUser` 创建账号 `admin`，密码用 bcrypt 哈希后存入 PostgreSQL。

**注意**：`ADMIN_PASSWORD` 为空时**不会创建 admin 用户**，将无法登录。

---

## 二、服务架构

```
┌─────────────────────────────────────────┐
│           panda-wiki (主服务)            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Go API  │ │ Consumer │ │ Next.js  │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘  │
│       │           │            │         │
│       └─────── Nginx (80) ─────┘         │
│                Supervisord               │
└────────┬──────┬──────┬──────┬────────────┘
         │      │      │      │
    PostgreSQL Redis  NATS  MinIO
```

| 容器 | 镜像 | 用途 |
|------|------|------|
| panda-wiki | `ghcr.io/baiqiqingshu/panda-wiki:latest` | 主服务（API + 前端 + Consumer） |
| panda-wiki-postgres | `postgres:17-alpine` | 数据库 |
| panda-wiki-redis | `redis:8-alpine` | 缓存 |
| panda-wiki-nats | `nats:2-alpine` | 消息队列 |
| panda-wiki-minio | `minio/minio:latest` | 对象存储 |

---

## 三、空服务器完整部署步骤

### 前置条件

- Linux 服务器（推荐 Ubuntu 22.04+）
- 已安装 Docker 和 Docker Compose（v2）
- 至少 2GB 可用内存

### 步骤 1：创建项目目录

```bash
mkdir -p /opt/PandaWiki
cd /opt/PandaWiki
```

### 步骤 2：下载 docker-compose.yml

```bash
# 方式一：直接从 GitHub 下载
curl -fsSL https://raw.githubusercontent.com/baiqiqingshu/PandaWiki/main/docker-compose.yml -o docker-compose.yml

# 方式二：手动创建（内容见附录）
```

### 步骤 3：创建 .env 配置文件

```bash
cat > .env << 'EOF'
# ======= PandaWiki 配置 =======

# Web 访问端口
WIKI_PORT=8900

# 管理员账号密码（账号固定为 admin）
ADMIN_PASSWORD=admin123

# PostgreSQL 密码
POSTGRES_PASSWORD=panda-wiki-secret

# Redis 密码（可留空）
REDIS_PASSWORD=

# NATS 密码（可留空）
NATS_PASSWORD=

# MinIO 配置
MINIO_ROOT_USER=s3panda-wiki
MINIO_ROOT_PASSWORD=panda-wiki-secret

# JWT 密钥（建议生产环境修改为随机字符串）
JWT_SECRET=panda-wiki-jwt-secret-change-me

# 日志级别 (-4=debug, 0=info, 4=warn, 8=error)
LOG_LEVEL=0
EOF
```

> **生产环境建议**：将密码替换为随机字符串
> ```bash
> # 生成随机密码
> POSTGRES_PASSWORD=$(openssl rand -hex 16)
> MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
> JWT_SECRET=$(openssl rand -hex 32)
> ```

### 步骤 4：启动服务

```bash
docker compose up -d
```

首次启动会自动拉取所有镜像（约 1GB），等待 1-3 分钟。

### 步骤 5：验证部署

```bash
# 查看所有容器状态（应全部 Up/Healthy）
docker compose ps

# 检查主服务日志
docker logs panda-wiki 2>&1 | tail -20

# 测试 HTTP 访问
curl -sI http://localhost:8900
```

### 步骤 6：访问 Wiki

浏览器打开 `http://<服务器IP>:8900`

| 项目 | 值 |
|------|-----|
| 账号 | `admin` |
| 密码 | `.env` 中 `ADMIN_PASSWORD` 的值 |

---

## 四、运维命令速查

```bash
# 进入项目目录
cd /opt/PandaWiki

# 启动
docker compose up -d

# 停止
docker compose down

# 重启某个服务
docker compose restart panda-wiki

# 查看日志
docker compose logs -f panda-wiki

# 更新镜像并重启
docker compose pull panda-wiki
docker compose up -d

# 修改 .env 后生效（需要重建容器）
docker compose up -d --force-recreate panda-wiki

# 完全清除（包括数据卷，慎用！）
docker compose down -v
```

---

## 五、修改管理员密码

���改 `.env` 中的 `ADMIN_PASSWORD`，然后重建容器：

```bash
# 编辑密码
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=新密码/' .env

# 重建容器（使新密码生效）
docker compose up -d --force-recreate panda-wiki
```

> **注意**：必须用 `--force-recreate`，普通 `restart` 不会重新读取 `.env`。

---

## 六、故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| 登录提示"用户名或密码错误" | `ADMIN_PASSWORD` 为空或容器未重建 | 设置 `.env` 中的 `ADMIN_PASSWORD`，执行 `docker compose up -d --force-recreate panda-wiki` |
| 页面显示 "Not Found" | `/api/v1/license` 接口缺失 | 使用最新镜像（已添加 license stub） |
| consumer 服务 panic | NATS stream 未初始化 | 使用最新镜像（已修复 stream 创建） |
| 容器反复重启 | 依赖服务未就绪 | `docker compose logs panda-wiki` 查看具体错误 |

---

## 七、文件清单

部署只需要 2 个文件：

```
/opt/PandaWiki/
├── docker-compose.yml    # 服务编排（从 GitHub 下载）
└── .env                  # 配置文件（手动创建）
```

镜像由 GitHub Actions 自动构建并推送到 `ghcr.io/baiqiqingshu/panda-wiki:latest`，服务器执行 `docker compose up -d` 时自动拉取。

---

## 八、一键部署脚本

将以下内容保存为 `install.sh`，在空服务器上执行即可：

```bash
#!/bin/bash
set -e

INSTALL_DIR="/opt/PandaWiki"
ADMIN_PWD="${1:-admin123}"

echo "=== PandaWiki 一键部署 ==="

# 创建目录
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 下载 docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/baiqiqingshu/PandaWiki/main/docker-compose.yml -o docker-compose.yml

# 生成 .env
cat > .env << EOF
WIKI_PORT=8900
ADMIN_PASSWORD=${ADMIN_PWD}
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=
NATS_PASSWORD=
MINIO_ROOT_USER=s3panda-wiki
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
LOG_LEVEL=0
EOF

# 启动
docker compose up -d

echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://$(hostname -I | awk '{print $1}'):8900"
echo "账号: admin"
echo "密码: ${ADMIN_PWD}"
```

**使用方式**：
```bash
# 默认密码 admin123
bash install.sh

# 自定义密码
bash install.sh MySecurePassword
```
