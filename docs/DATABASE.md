# 数据库

## 当前实体表

| 表 | 用途 |
|---|---|
| `user` | 用户基本信息（openid/nickname/avatarUrl） |
| `user_detail` | 用户设置（语音/动画/震动开关） |
| `room` | 编队（含 scoreMode、roundInputMethod、trustMode、zeroSumRequired、allRecord JSON 归档） |
| `room_member` | 编队成员（含 quit_time、final_score） |
| `round_record` | 本局录记录（状态机：pending_member_input / pending_confirm / applied / rejected / cancelled） |
| `round_record_detail` | 本局录明细（每用户得分） |
| `user_mirror_profile` | 镜像档案（MBTI + 战斗人格 + 综合解读，PK=userId） |
| `mirror_birth_profile` | 出生档案（预留，不在当前主流程展示） |
| `fortune_log` | 指令生成日志（prompt、响应、source、耗时、错误） |
| `user_identity_level` | 身份等级、经验、稳定度 |

## 持久化边界

MySQL 负责：用户、编队元数据、成员关系、设置、镜像档案、指令日志、授权等级、封存归档。封存和本局录生效写 MySQL；趋势/身份/镜像主要从历史归档计算。运行期频繁变化状态不得新增 MySQL 读写依赖。

## 归档模型

一个编队 = 一次任务航程记录。无 session 表。封存时归档到 `room.all_record`，成员最终值写入 `room_member.final_score`，`quit_time` 标记历史样本。航迹样本在工程层对应 `room.all_record`、`room_member.final_score`、历史归档、趋势统计和指令/镜像/身份的输入样本。

## 索引清单

| 表 | 索引 | 类型 | 用途 |
|---|---|---|---|
| `user` | `uk_openid` | UNIQUE | openid 唯一 |
| `room` | `uk_room_no` | UNIQUE | 编队码唯一 |
| `room` | `idx_owner_id` | INDEX | 按主控查询 |
| `room` | `idx_status_active` | INDEX | 扫描活跃编队（V5） |
| `room_member` | `uk_room_user` | UNIQUE | 防重复加入 |
| `room_member` | `idx_user_id` | INDEX | 按用户查询 |
| `round_record` | `idx_room_id` | INDEX | 按编队查询 |
| `round_record` | `idx_room_status` | INDEX | 按编队+状态查询 |
| `round_record_detail` | `idx_round_record_id` | INDEX | 按本局录查询 |
| `fortune_log` | `idx_user_id` / `idx_source` / `idx_user_date` | INDEX | 按用户/来源/用户+时间 |
| `user_identity_level` | PK `user_id` | PRIMARY | 用户维度 |
| `user_mirror_profile` | PK `user_id` | PRIMARY | 用户维度 |
| `audit_log` | `idx_admin_id` / `idx_created_at` | INDEX | 按管理员/时间 |
| `async_task` | `uk_task_type_biz_key` | UNIQUE | 任务去重 |
| `async_task` | `idx_status_next_run` | INDEX | 调度器查询待执行 |

## 注意事项

- 所有实体 ID 由 `SnowflakeIdGenerator` 生成，禁止数据库自增。
- 后端字段名/表名/API 路径可沿用既有命名，不为世界观改底层协议。
- MySQL 热路径减少是收敛目标，不可描述为已完成。
