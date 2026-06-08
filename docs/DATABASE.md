# 数据库

## 当前实体表

| 表 | 用途 |
|---|---|
| `user` | 用户基本信息（openid/nickname/avatarUrl） |
| `user_detail` | 用户设置（语音/动画/震动开关） |
| `room` | 编队（工程层表名仍为 room，含 scoreMode、roundInputMethod、trustMode、zeroSumRequired、allRecord JSON 归档） |
| `room_member` | 编队成员（含 quit_time、final_score） |
| `round_record` | 本局录记录（状态机：pending_member_input / pending_confirm / applied / rejected / cancelled） |
| `round_record_detail` | 本局录明细（每用户得分） |
| `user_mirror_profile` | 镜像档案（MBTI + 战斗人格 + 综合解读，PK=userId） |
| `mirror_birth_profile` | 出生档案（预留，不在当前主流程展示） |
| `fortune_log` | 指令生成日志（prompt、响应、source、耗时、错误） |
| `user_identity_level` | 身份等级、经验、稳定度 |

## 持久化边界

MySQL 负责：

- 用户
- 编队元数据
- 成员关系
- 用户设置
- 镜像档案
- 指令日志
- 授权等级
- 封存归档

运行期频繁变化状态不得新增 MySQL 读写依赖。

## 当前归档模型

- 一个编队 = 一次任务航程记录。
- 没有 session 表。
- 封存时把运行期数据归档到 `room.all_record`。
- 成员最终值写入 `room_member.final_score`。
- `quit_time` 标记历史样本。
- 航迹样本在工程层主要对应 `room.all_record`、`room_member.final_score`、历史归档、趋势统计和指令/镜像/身份的输入样本。

## 数据库注意事项

- 所有实体 ID 由 `SnowflakeIdGenerator` 生成，禁止依赖数据库自增。
- 创建编队、成员关系、用户设置、镜像档案、指令日志、授权等级进入 MySQL。
- 封存和本局录生效会写 MySQL。
- 趋势、身份、镜像主要从历史归档数据计算。
- 后端字段名、数据库表名和 API 路径可以沿用既有命名，不为世界观强行改底层协议。
- 不要将 MySQL 热路径减少描述成已经完成；这仍是收敛目标。
