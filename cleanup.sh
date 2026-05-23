#!/bin/bash
#
# PandaWiki 环境清理脚本
# 用途：停止并删除所有容器、网络、数据目录，实现完全重置后可重新部署
# 使用：在 docker-compose.yml 同级目录执行  bash cleanup.sh
#

set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
DATA_DIR="${COMPOSE_DIR}/data"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  PandaWiki 环境清理脚本${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# 确认 docker-compose.yml 存在
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo -e "${RED}[错误] 未找到 ${COMPOSE_FILE}${NC}"
    exit 1
fi

# 显示数据目录大小
if [ -d "${DATA_DIR}" ]; then
    DATA_SIZE=$(du -sh "${DATA_DIR}" 2>/dev/null | cut -f1)
    echo -e "数据目录: ${DATA_DIR}"
    echo -e "占用空间: ${YELLOW}${DATA_SIZE}${NC}"
else
    echo -e "数据目录: ${DATA_DIR} (不存在)"
fi
echo ""

# 二次确认
echo -e "${RED}[警告] 此操作将执行以下清理：${NC}"
echo "  1. 停止并删除所有 PandaWiki 容器"
echo "  2. 删除数据目录 ./data（PostgreSQL / Redis / NATS / MinIO）"
echo "  3. 删除关联的 Docker 网络"
echo ""
echo -e "${RED}  ⚠  所有数据将被永久删除且不可恢复！${NC}"
echo ""

read -rp "确认清理？输入 yes 继续: " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "已取消操作。"
    exit 0
fi

echo ""
echo -e "${GREEN}[1/3] 停止并移除容器...${NC}"
docker compose -f "${COMPOSE_FILE}" down --remove-orphans 2>/dev/null || \
docker-compose -f "${COMPOSE_FILE}" down --remove-orphans 2>/dev/null || true

echo -e "${GREEN}[2/3] 删除数据目录...${NC}"
if [ -d "${DATA_DIR}" ]; then
    rm -rf "${DATA_DIR}"
    echo "  已删除: ${DATA_DIR}"
else
    echo "  数据目录不存在(跳过)"
fi

echo -e "${GREEN}[3/3] 清理悬空镜像(可选)...${NC}"
docker image prune -f 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  清理完成！可重新执行部署：${NC}"
echo -e "${GREEN}  docker compose up -d${NC}"
echo -e "${GREEN}========================================${NC}"
