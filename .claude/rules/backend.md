# 后端规则

## Java / Spring

- Java 使用 Lombok（`@Data`、`@Slf4j`、`@RequiredArgsConstructor`），不要手写 getter/setter。
- 统一返回结构 `Result<T>`。
- 业务异常用 `BizException`。
- Controller 只做参数校验和转发，业务逻辑在 Service 层。
- 所有 DTO 必须有 `@Schema` 注解和 `example` 示例值。
- 代码注释使用中文。
- 后端字段名、数据库表名和 API 路径可以沿用既有命名，不为世界观强行改底层协议。

## ID 与持久化

- 所有实体 ID 由 `SnowflakeIdGenerator` 生成，禁止依赖数据库自增。
- MySQL 负责用户、空间元数据、成员关系、用户设置、镜像档案、策略日志、身份等级、封存归档。
- 运行期频繁变化状态不得新增 MySQL 读写依赖。
- 新增运行期功能必须优先使用 Redis Hash/ZSet/List 与 Lua 原子操作。
- MySQL 热路径只能作为待收敛技术债处理，不能描述成已经实现的「MySQL 零参与」。

## Redis / WebSocket

- 空间成员数严格限制 `MAX_MEMBERS = 16`。
- 接入空间前必须先做 Redis 侧容量校验，超过阈值立即 fail-fast。
- Redis 连接失败、脚本失败、锁失败必须被业务层捕获，统一返回 `Result` 结构和可识别 code。
- WebSocket `/ws/score` 以空间为广播单位，避免无差别广播。
- 自动封存/解散必须同时识别 `events` 与 `batches`，自由流转模式不能因为没有批次记录就被误判为空空间。

## 模块边界

- 空间模块负责启动/接入空间、成员、记录、封存、复盘数据。
- 策略模块负责今日指令投影、缓存、刷新和输出安全过滤。
- 镜像模块负责人格协议、黑匣子样本读取、镜像投影和五维扫描。
- 身份模块负责舰员代号、头盔识别、权限等级、数据矩阵和装备协议。
- 语音/TTS 负责音色目录、试听、TTS 生成和语音播报。
