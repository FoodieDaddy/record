#!/bin/bash
# 清空 Redis 所有 key 并重置数据库数据
# 用法: bash scripts/reset-data.sh

set -e

REDIS_HOST="${SPRING_REDIS_HOST:-localhost}"
REDIS_PORT="${SPRING_REDIS_PORT:-16379}"
REDIS_DB="${SPRING_REDIS_DB:-0}"

MYSQL_HOST="${SPRING_DATASOURCE_HOST:-localhost}"
MYSQL_PORT="${SPRING_DATASOURCE_PORT:-13306}"
MYSQL_DB="${SPRING_DATASOURCE_DB:-smartrecord}"
MYSQL_USER="${SPRING_DATASOURCE_USERNAME:-root}"
MYSQL_PASS="${SPRING_DATASOURCE_PASSWORD:-root123}"

echo "=== 脉冲终端数据重置 ==="
echo ""

# 1. 清空 Redis
echo "[1/2] 清空 Redis ($REDIS_HOST:$REDIS_PORT db=$REDIS_DB) ..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DB" FLUSHDB
echo "Redis 已清空。"
echo ""

# 2. 调用存储过程
echo "[2/2] 重置数据库 ($MYSQL_HOST:$MYSQL_PORT/$MYSQL_DB) ..."
docker exec sr-mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "CALL TruncateAllTables();"
echo "数据库已重置。"
echo ""

echo "=== 完成 ==="
