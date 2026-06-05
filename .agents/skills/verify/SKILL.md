---
name: verify
description: 验证后端编译通过、Docker 容器健康、API 可访问。在修改 Java 代码后使用。
---

## 验证步骤

按顺序执行以下检查，任何一步失败则停止并报告错误。

### 1. 后端编译

```bash
cd /Users/happy/Documents/record/backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

编译失败时：定位错误文件和行号，提出修复方案。

### 2. Docker 容器状态

```bash
docker compose -f /Users/happy/Documents/record/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}"
```

所有容器应为 `Up` 状态。如果有容器异常，检查日志：
```bash
docker compose -f /Users/happy/Documents/record/docker-compose.yml logs --tail=20 <container>
```

### 3. API 可访问性

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/api/swagger-ui.html
```

期望返回 200。如果后端未运行，提示用户先启动：
```bash
cd /Users/happy/Documents/record/backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run
```

## 使用方式

用户可通过 `/verify` 触发，Codex 也可在修改 Java 代码后主动调用。

## 报告格式

```
✅ 编译通过
✅ Docker 容器正常 (3/3)
✅ API 可访问 (HTTP 200)

或

❌ 编译失败: [具体错误]
```
