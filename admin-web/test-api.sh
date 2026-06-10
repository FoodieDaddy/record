#!/bin/bash
# 太空记分器 · 基地总控台 API 全量测试脚本

BASE_URL="http://localhost:18080/api"
PASS=0
FAIL=0
TOKEN=""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_api() {
  local method=$1
  local endpoint=$2
  local expected_code=$3
  local data=$4
  local desc=$5

  local auth_header=""
  if [ -n "$TOKEN" ]; then
    auth_header="-H \"Authorization: Bearer $TOKEN\""
  fi

  local response
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$data" 2>/dev/null)
  elif [ "$method" = "PUT" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$data" 2>/dev/null)
  fi

  local http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')
  local api_code=$(echo "$body" | grep -o '"code":[0-9]*' | head -1 | cut -d: -f2)

  if [ "$http_code" = "200" ] && [ "$api_code" = "200" ]; then
    echo -e "${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  elif [ "$http_code" = "200" ] && [ -z "$api_code" ]; then
    echo -e "${GREEN}✓${NC} $desc (HTTP 200)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗${NC} $desc (HTTP $http_code, code=$api_code)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo "  太空记分器 · 基地总控台 API 测试"
echo "=========================================="
echo ""

# 1. 管理员认证
echo -e "${YELLOW}▸ 管理员认证${NC}"
test_api "POST" "/admin/login" 200 '{"username":"admin","password":"admin123"}' "管理员登录"

# 获取 token
TOKEN=$(curl -s -X POST "$BASE_URL/admin/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}无法获取 token，测试终止${NC}"
  exit 1
fi
echo ""

# 2. Dashboard
echo -e "${YELLOW}▸ Dashboard${NC}"
test_api "GET" "/admin/dashboard/overview" 200 "" "总览指标"
test_api "GET" "/admin/dashboard/trends" 200 "" "趋势数据"
test_api "GET" "/admin/dashboard/events" 200 "" "事件流"
test_api "GET" "/admin/dashboard/trace-stats" 200 "" "航迹统计"
test_api "GET" "/admin/dashboard/pulse-stats" 200 "" "脉冲统计"
test_api "GET" "/admin/dashboard/pulse-trends" 200 "" "脉冲趋势"
echo ""

# 3. 用户管理
echo -e "${YELLOW}▸ 用户管理${NC}"
test_api "GET" "/admin/users?page=1&size=10" 200 "" "用户列表"
USER_ID=$(curl -s "$BASE_URL/admin/users?page=1&size=1" -H "Authorization: Bearer $TOKEN" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "$USER_ID" ]; then
  test_api "GET" "/admin/users/$USER_ID" 200 "" "用户详情"
  test_api "GET" "/admin/users/$USER_ID/formations" 200 "" "用户编队历史"
  test_api "PUT" "/admin/users/$USER_ID/status?status=1" 200 "" "修改用户状态"
fi
echo ""

# 4. 编队管理
echo -e "${YELLOW}▸ 编队管理${NC}"
test_api "GET" "/admin/formations?page=1&size=10" 200 "" "编队列表"
ROOM_ID=$(curl -s "$BASE_URL/admin/formations?page=1&size=1" -H "Authorization: Bearer $TOKEN" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "$ROOM_ID" ]; then
  test_api "GET" "/admin/formations/$ROOM_ID" 200 "" "编队详情"
fi
echo ""

# 5. 指令日志
echo -e "${YELLOW}▸ 指令日志${NC}"
test_api "GET" "/admin/directives/logs?page=1&size=10" 200 "" "指令日志列表"
echo ""

# 6. 镜像档案
echo -e "${YELLOW}▸ 镜像档案${NC}"
test_api "GET" "/admin/mirrors?page=1&size=10" 200 "" "镜像档案列表"
echo ""

# 7. 系统监控
echo -e "${YELLOW}▸ 系统监控${NC}"
test_api "GET" "/admin/system/health" 200 "" "系统健康状态"
test_api "GET" "/admin/system/alerts?page=1&size=10" 200 "" "告警列表"
test_api "GET" "/admin/system/sentinel" 200 "" "Sentinel 信息"
echo ""

# 8. 管理员管理
echo -e "${YELLOW}▸ 管理员管理${NC}"
test_api "GET" "/admin/admins?page=1&size=10" 200 "" "管理员列表"
TEST_USER="testadmin_$(date +%s)"
test_api "POST" "/admin/admins" 200 "{\"username\":\"$TEST_USER\",\"password\":\"test123\",\"role\":\"VIEWER\"}" "创建管理员"
TEST_ADMIN_ID=$(curl -s "$BASE_URL/admin/admins?page=1&size=10" -H "Authorization: Bearer $TOKEN" | grep -o '"id":[0-9]*' | tail -1 | cut -d: -f2)
if [ -n "$TEST_ADMIN_ID" ]; then
  test_api "GET" "/admin/admins/$TEST_ADMIN_ID" 200 "" "管理员详情"
  test_api "PUT" "/admin/admins/$TEST_ADMIN_ID/status?status=0" 200 "" "禁用管理员"
fi
echo ""

# 9. 审计日志
echo -e "${YELLOW}▸ 审计日志${NC}"
test_api "GET" "/admin/audit?page=1&size=10" 200 "" "审计日志列表"
echo ""

# 10. 错误场景测试
echo -e "${YELLOW}▸ 错误场景${NC}"
# 未认证访问（项目约定 HTTP 200 + 业务错误码 4001）
RESP_BODY=$(curl -s "$BASE_URL/admin/users" 2>/dev/null)
API_CODE=$(echo "$RESP_BODY" | grep -o '"code":[0-9]*' | head -1 | cut -d: -f2)
if [ "$API_CODE" = "4001" ]; then
  echo -e "${GREEN}✓${NC} 未认证访问返回 code=4001 (终端未接入)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✗${NC} 未认证访问返回 code=$API_CODE (期望 4001)"
  FAIL=$((FAIL + 1))
fi

# 不存在的资源
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/users/999999999999" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓${NC} 不存在的用户返回 200 (null)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✗${NC} 不存在的用户返回 $HTTP_CODE"
  FAIL=$((FAIL + 1))
fi
echo ""

# 结果汇总
echo "=========================================="
echo -e "  测试完成: ${GREEN}$PASS 通过${NC} / ${RED}$FAIL 失败${NC}"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
