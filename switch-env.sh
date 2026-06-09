#!/bin/bash
# 环境切换脚本 — 本地开发 ↔ 云服务器部署
# 用法: ./switch-env.sh local|dev

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'
info() { echo -e "${GREEN}[switch]${NC} $*"; }
warn() { echo -e "${YELLOW}[switch]${NC} $*"; }

ENV="${1:-}"
CONFIG_FILE="$(dirname "$0")/miniprogram/config.js"

if [ -z "$ENV" ]; then
  echo "用法: ./switch-env.sh <local|dev>"
  echo "  local — 本地开发（localhost:18080）"
  echo "  dev   — 云服务器（需在 miniprogram/config.js 中配置 dev 地址）"
  exit 1
fi

case "$ENV" in
  local)
    # 切换小程序指向本地
    sed -i '' "s/const currentEnv = '.*'/const currentEnv = 'local'/" "$CONFIG_FILE"
    info "小程序已切换到本地环境 (localhost:18080)"
    warn "后端请在 IDE 中启动，基础设施请运行: docker-compose up -d"
    ;;
  dev)
    # 切换小程序指向服务器
    sed -i '' "s/const currentEnv = '.*'/const currentEnv = 'dev'/" "$CONFIG_FILE"
    info "小程序已切换到云服务器环境"
    warn "如需部署后端: ./deploy.sh"
    ;;
  *)
    echo "未知环境: $ENV（可选: local, dev）"
    exit 1
    ;;
esac
