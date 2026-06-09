#!/bin/bash
# 部署脚本 — 构建后端 jar 并部署到云服务器
# 用法: ./deploy.sh

set -euo pipefail

# ========== 配置（通过环境变量或 .env 注入） ==========
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 加载 .env（如果存在）
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

SERVER="${DEPLOY_SERVER:?请设置 DEPLOY_SERVER 环境变量，如 root@1.2.3.4}"
PEM="${DEPLOY_PEM:?请设置 DEPLOY_PEM 环境变量，如 ~/.ssh/id_rsa}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/smartrecord}"
SSH_OPTS="-i $PEM -o StrictHostKeyChecking=no"

# ========== 颜色输出 ==========
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
info() { echo -e "${GREEN}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ========== 1. 本地构建 ==========
info "构建后端 jar ..."
cd "$PROJECT_DIR/backend"
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn package -DskipTests -q
JAR=$(ls target/*.jar)
info "构建完成: $JAR"

# ========== 2. 上传文件 ==========
info "上传 jar 到服务器 ..."
scp $SSH_OPTS "$JAR" "$SERVER:$REMOTE_DIR/backend/target/"

info "上传 Dockerfile ..."
scp $SSH_OPTS "$PROJECT_DIR/Dockerfile" "$SERVER:$REMOTE_DIR/"

info "上传 docker-compose.prod.yml ..."
scp $SSH_OPTS "$PROJECT_DIR/docker-compose.prod.yml" "$SERVER:$REMOTE_DIR/docker-compose.yml"

# ========== 3. 重新构建镜像并重启 ==========
info "重建 Docker 镜像 ..."
ssh $SSH_OPTS "$SERVER" "cd $REMOTE_DIR && docker-compose build --no-cache app"

info "重启容器 ..."
ssh $SSH_OPTS "$SERVER" "cd $REMOTE_DIR && docker-compose up -d app"

# ========== 4. 健康检查 ==========
info "等待服务启动（约 40 秒） ..."
sleep 40
# 检查容器是否在运行
if ssh $SSH_OPTS "$SERVER" "docker ps --filter name=sr-app --format '{{.Status}}'" | grep -q "Up"; then
  # 检查端口是否可访问
  if ssh $SSH_OPTS "$SERVER" "curl -sf http://localhost:18080/api/ > /dev/null 2>&1"; then
    info "部署成功，服务正常"
  else
    err "容器已启动但端口未响应，可能正在初始化，请稍后检查"
  fi
else
  err "容器未启动，请检查日志: ssh $SERVER 'docker logs sr-app --tail 50'"
  exit 1
fi
