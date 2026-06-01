# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

麻将记分器微信小程序。后端 Java (Spring Boot 3.2.5) + 前端原生微信小程序。

## 启动命令

```bash
# 基础设施（MySQL 13306, Redis 16379, MinIO 19000/19001）
docker-compose up -d

# 后端（端口 18080，需指定 Java 21）
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run

# 前端：微信开发者工具导入 miniprogram/ 目录
```

## 架构要点

- **实时数据走 Redis**：场次排行榜 (Sorted Set)、批次得分 (Hash)、分布式锁 (Redisson)
- **持久化走 MySQL**：场次结算时 @Async 异步批量落库（ScoreSettleTask）
- **图片直传 MinIO**：后端签发预签名 PUT URL，前端压缩后直传，不经过后端中转
- **实时推送**：WebSocket (`/ws/score`)，房间级广播，记分后推送给同房间所有玩家
- **雪花 ID**：所有实体 ID 由 `SnowflakeIdGenerator` 生成，非数据库自增

## 代码规范

- Java 使用 Lombok（@Data, @Slf4j, @RequiredArgsConstructor），不要手写 getter/setter
- 统一返回结构 `Result<T>`，业务异常用 `BizException`
- Controller 只做参数校验和转发，业务逻辑在 Service 层
- 所有 DTO 必须有 `@Schema` 注解和 `example` 示例值
- 前端 WXML/WXSS 使用 2 空格缩进
- 代码注释使用中文

## 非显而易见的模式

- 房间号生成：Redis SETNX，32 字符集（去 O/0/I/L），6 位，碰撞重试最多 10 次
- 记分并发控制：Redisson `tryLock(5s, 30s)`，锁 key 为 `mj:session:{sid}:lock`
- 场次得分聚合：session 表不存总分，进行中读 Redis Sorted Set，已结算读 MySQL GROUP BY
- 2 分钟聚合：前端同一次提交的多条 score 记录共享相同秒级 `created_at`，前端按此分组渲染
- 小程序码：后端调微信 `getUnlimited` API → 字节流 → MinIO PUT → 返回访问 URL

## 安全注意

- `application.yml` 中的密码和密钥仅用于本地开发，生产环境必须替换
- 不要将 `target/` 目录提交到版本控制
- JWT secret 至少 256 位

## 端口规划（避开常用端口）

| 服务 | 端口 |
|---|---|
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |
| MinIO API | 19000 |
| MinIO Console | 19001 |
