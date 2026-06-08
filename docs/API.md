# 接口文档

本文档记录前端已依赖的核心接口契约。不是 OpenAPI 全量规范，仅作为前后端协作参考。

## 通用约定

### 认证

所有需要认证的接口通过 `HttpServletRequest` 提取 `currentUserId`（由鉴权拦截器设置）。前端通过 `Authorization` 请求头传递 JWT。

### 返回结构

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- `code = 0` 表示成功
- `code != 0` 表示业务错误，`message` 包含可展示的错误描述
- 分页接口使用 `PageResult<T>`：`{ "total": 100, "records": [] }`

### WebSocket

- 端点：`/ws/score`
- 认证：通过 `Sec-WebSocket-Protocol` 头传递 token
- 广播单位：以编队为粒度，不进行无差别广播
- 在线状态：`PRESENCE_UPDATE` 推送当前在线成员 ID 列表，用于编队席位链路状态展示

---

## 用户模块 `/user`

### POST `/user/login`

微信登录，换取 JWT。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | String | 是 | wx.login 返回的 code |
| nickname | String | 否 | 昵称（首次登录时可传） |
| avatarUrl | String | 否 | 头像 URL（首次登录时可传） |

返回 `LoginResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| token | String | JWT |
| userId | Long | 用户 ID |
| nickname | String | 本舰呼号 |
| avatarUrl | String | 识别徽标 URL |

### GET `/user/me`

获取当前用户信息。

返回 `UserInfoResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | Long | 用户 ID |
| nickname | String | 本舰呼号 |
| avatarUrl | String | 识别徽标 URL |
| createdAt | String | 注册时间 |
| userDetail | UserDetailResp | 用户设置 |

### PUT `/user/me`

更新本舰呼号/识别徽标。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| nickname | String | 否 | 本舰呼号（最长 12 字符） |
| avatarUrl | String | 否 | 识别徽标 URL |

### GET `/user/detail`

获取用户设置。

返回 `UserDetailResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| voiceEnabled | Boolean | 通讯协议开关 |
| voiceId | String | 音色 ID |
| animEnabled | Boolean | 视觉协议开关 |
| vibrateEnabled | Boolean | 触感协议开关 |

### PUT `/user/detail`

更新用户设置。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| voiceEnabled | Boolean | 否 | 通讯协议开关 |
| voiceId | String | 否 | 音色 ID |
| animEnabled | Boolean | 否 | 视觉协议开关 |
| vibrateEnabled | Boolean | 否 | 触感协议开关 |

### GET `/user/identity-level`

获取授权等级与航行经验。

返回 `IdentityLevelResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| level | Integer | 等级（1-5） |
| title | String | 等级称号 |
| exp | Long | 当前总经验 |
| currentLevelExp | Long | 当前等级起始经验 |
| requiredExpInLevel | Long | 升级所需经验 |
| nextLevelExp | Long | 下一等级起始经验 |
| progress | Integer | 进度百分比（0-100） |
| stability | Integer | 稳定度（0-100，可为 null） |

---

## 编队模块 `/room`

### POST `/room`

创建编队。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| scoreMode | Integer | 否 | 1 | 1=自由流转，2=本局录入 |
| roundInputMethod | Integer | 否 | 1 | 1=主控填写，2=成员自填 |
| trustMode | Integer | 否 | 1 | 0=标准协议，1=快速协议 |
| zeroSumRequired | Integer | 否 | 1 | 0=自由封存，1=零和封存 |
| autoTimeoutSeconds | Integer | 否 | 30 | 自动超时秒数 |
| autoTimeoutAction | Integer | 否 | 1 | 1=自动同意，2=自动取消 |

返回 `RoomResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| roomId | Long | 编队 ID |
| roomNo | String | 编队码（6 位） |
| ownerId | Long | 主控用户 ID |
| scoreMode | Integer | 计分模式 |
| status | Integer | 0=进行中，1=已封存 |
| qrCodeUrl | String | 信标图片 URL |
| members | List\<MemberVO\> | 编队成员列表 |
| createdAt | String | 创建时间 |

`MemberVO`：

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | Long | 用户 ID |
| nickname | String | 本舰呼号 |
| avatarUrl | String | 识别徽标 URL |
| finalScore | Long | 最终分数（封存后有值） |

### POST `/room/join`

加入编队。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomNo | String | 二选一 | 编队码 |
| scanRoomNo | String | 二选一 | 从信标解析出的编队码 |

返回 `RoomResp`（同上）。

### GET `/room/{roomId}`

获取编队详情。

返回 `RoomResp`（同上）。

### GET `/room/my`

获取当前用户参与的编队列表。

返回 `List<RoomResp>`。

### DELETE `/room/{roomId}/quit`

退出编队。主控退出等同于解散编队。

### GET `/room/history`

获取已封存的历史编队列表。

返回 `List<RoomResp>`。

### PUT `/room/{roomId}/settings`

主控更新编队设置。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roundInputMethod | Integer | 否 | 1=主控填写，2=成员自填 |
| trustMode | Integer | 否 | 0=标准协议，1=快速协议 |
| zeroSumRequired | Integer | 否 | 0=自由封存，1=零和封存 |
| autoTimeoutSeconds | Integer | 否 | 自动超时秒数 |
| autoTimeoutAction | Integer | 否 | 1=自动同意，2=自动取消 |

---

## 记分模块 `/score`

### POST `/score/transfer`

自由流转模式：A 向 B 记分。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | Long | 是 | 编队 ID |
| toUserId | Long | 是 | 目标用户 ID |
| amount | Integer | 是 | 分数（最小 1） |
| remark | String | 否 | 备注 |

返回 `TransferScoreResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | Long | 流转记录 ID |
| fromUser | UserInfo | 发起方 |
| toUser | UserInfo | 接收方 |
| amount | Integer | 分数 |
| amountDisplay | String | 展示用分数文本 |
| remark | String | 备注 |
| createdAt | String | 时间 |

### GET `/score/room/{roomId}/transfer-amount-suggestions`

获取常用数值推荐。后端从 Redis 小排行读取个人常用数值和编队高频数值，数据不足时随机补齐，不扫描流水计算。

返回 `TransferAmountSuggestionResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| fallback | Boolean | 是否使用随机补齐 |
| items | List\<Item\> | 推荐项，最多 6 个 |

`Item`：

| 字段 | 类型 | 说明 |
|---|---|---|
| amount | Integer | 推荐数值 |
| source | String | `crew`=个人常用，`space`=编队高频，`random`=随机补齐 |
| label | String | 展示标签 |

### POST `/score/room/{roomId}/settle`

主控封存航程。

返回 `SettleResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| roomId | Long | 编队 ID |
| roomNo | String | 编队码 |
| timestamps | List\<Long\> | 时间轴（毫秒） |
| series | List\<Series\> | 分数曲线 |
| memberScores | List\<MemberScore\> | 成员最终分数 |
| autoSettled | Boolean | 是否自动封存 |

### GET `/score/trend`

获取用户近期净数值趋势。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| limit | Integer | 否 | 20 | 返回条数（最大 50） |

返回 `TrendResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| points | List | 趋势点列表 |

每个趋势点：

| 字段 | 类型 | 说明 |
|---|---|---|
| roomId | Long | 编队 ID |
| date | String | 日期 |
| netScore | Long | 净数值 |

### GET `/score/yield-log`

获取航迹档案摘要与航程记录。

返回 `YieldLogResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| netYield | Long | 总净数值 |
| sampleCount | Integer | 样本数 |
| curveUnlockCount | Integer | 曲线解锁所需样本数 |
| curveData | List\<CurvePoint\> | 净数值曲线数据 |
| records | List\<YieldRecord\> | 航程记录列表 |

`CurvePoint`：

| 字段 | 类型 | 说明 |
|---|---|---|
| roomId | Long | 编队 ID |
| date | String | 日期 |
| netScore | Long | 净数值 |

`YieldRecord`：

| 字段 | 类型 | 说明 |
|---|---|---|
| roomId | Long | 编队 ID |
| roomNo | String | 编队码 |
| settledAt | String | 封存时间 |
| myScore | Long | 本人分数 |
| myRank | Integer | 本人排名 |
| memberCount | Integer | 参与人数 |

### GET `/score/room/{roomId}/chart`

获取编队数值演化折线图数据。

返回 `ChartDataResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| timestamps | List\<Long\> | 时间轴（毫秒） |
| series | List\<Series\> | 每人一条曲线 |

`Series`：

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | Long | 用户 ID |
| nickname | String | 本舰呼号 |
| scores | List\<Long\> | 累计分数序列 |

### GET `/score/room/{roomId}/insight`

获取编队洞察数据。

返回 `RoomInsightResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| totalTransfer | Long | 总流转数值 |
| maxSingleTransfer | Long | 最大单笔 |
| mostActiveUser | ActiveUser | 最活跃成员 |
| transferCount | Integer | 流转次数 |
| networkDensity | String | 网络密度（HIGH/MEDIUM/LOW） |

### GET `/score/room/{roomId}/network`

获取编队数值关系网络图。

返回 `RoomNetworkResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| nodes | List\<Node\> | 节点列表 |
| links | List\<Link\> | 连接列表 |

`Node`：`userId`, `nickname`, `avatarUrl`, `score`
`Link`：`from`, `to`, `netAmount`, `count`

---

## 本局录入模块 `/round`

### POST `/round/start`

主控发起本局录入。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | Long | 是 | 编队 ID |

返回 `RoundRecordResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | Long | 录入记录 ID |
| roomId | Long | 编队 ID |
| status | Integer | 1=待录入，2=待确认，3=已生效，4=已驳回，5=已取消 |
| inputMethod | Integer | 录入方式 |
| trustMode | Integer | 协议模式 |
| zeroSumRequired | Integer | 零和模式 |
| createdBy | Long | 发起人 ID |
| totalScore | Integer | 总分 |
| details | List\<DetailVO\| | 明细 |
| memberSubmitted | Integer | 已提交人数 |
| memberTotal | Integer | 总人数 |
| confirmCount | Integer | 已确认人数 |
| confirmTotal | Integer | 需确认总人数 |
| createdAt | String | 创建时间 |

`DetailVO`：`userId`, `nickname`, `avatarUrl`, `score`, `submitted`, `confirmed`

### POST `/round/submit`

提交分数。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | Long | 是 | 编队 ID |
| scores | List | 是 | 分数列表（`userId`, `score`） |

### POST `/round/confirm`

确认或驳回。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | Long | 是 | 编队 ID |
| agree | Boolean | 是 | true=确认，false=驳回 |

### POST `/round/cancel`

主控取消待录入的记录。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | Long | 是 | 编队 ID |

### GET `/round/pending`

获取当前待处理的录入记录。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roomId | Long | 是 | 编队 ID |

---

## 导航核心模块 `/fortune`

### GET `/fortune/today`

获取今日指令投影。后端 LLM 最长响应时间为 25 秒，前端请求 timeout 应设为 28~30 秒。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| force | Boolean | 否 | false | 是否强制刷新 |

返回 `FortuneResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| verdict | String | 状态读数 |
| buffs | List\<String\> | 推进节奏（正面建议） |
| debuffs | List\<String\> | 安全边界（风险提醒） |
| themeColor | String | 主题色（HEX） |
| glowColor | String | 辉光色（HEX） |
| tag | String | 状态标签（2-4 字） |
| userTag | String | 用户状态枚举 |
| source | String | 指令源（llm/fallback） |
| lunarDate | String | 农历日期 |
| solarTerm | String | 观测窗标签 |
| title | String | 原型名称（中文） |
| subtitle | String | 原型副标题 |
| tags | List\<String\> | 附加标签 |
| nextRefreshAt | String | 下次可校准时间（HH:mm:ss），前端优先使用 nextRefreshAtEpochMs |
| nextRefreshAtEpochMs | Long | 下次可校准时间戳（毫秒），跨天场景准确 |

---

## 镜像模块 `/mirror`

### GET `/mirror/profile`

获取镜像投影（MBTI + 行为画像）。

返回 `MirrorProfileResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| mbti | ProfileInfo | 人格协议信息 |
| battlePersona | BattlePersonaInfo | 行为画像 |
| dimensions | List\<DimensionInfo\> | 五维扫描数据 |
| reading | ReadingInfo | 系统判读 |
| traits | List\<String\> | 认知特征标签 |
| personaMatch | PersonaMatchInfo | 协议偏移 |
| personaConfidence | Integer | 协议一致率（0-100） |

`ProfileInfo`：`calibrated`, `mbtiCode`, `confidence`, `mbtiSource`（test/direct）, `calibratedAt`

`BattlePersonaInfo`：`generated`, `sampleSize`, `sampleRange`, `tag`, `title`, `summary`, `calculatedAt`

`DimensionInfo`：`key`, `label`, `value`（0-100）, `desc`

`ReadingInfo`：`available`, `text`, `observation`, `deviation`, `risk`, `growthAdvice`

`PersonaMatchInfo`：`available`, `matchPercentage`, `prediction`, `actualSummary`, `summary`, `inferredMbtiType`, `inferredMbtiTitle`, `deviationPercent`

### POST `/mirror/profile/refresh`

刷新行为画像（清缓存后重算）。

返回同 `MirrorProfileResp`。

### POST `/mirror/mbti/test`

提交 20 题 MBTI 测试。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| testVersion | String | 是 | 测试版本号 |
| answers | List | 是 | 答案列表 |

答案项：`questionId`, `dimension`（E_I/S_N/T_F/J_P）, `score`（1/-1/0）

返回 `ProfileInfo`。

### POST `/mirror/mbti/direct`

直接输入 MBTI 编号。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| mbtiCode | Integer | 是 | MBTI 编号（1-16） |

返回 `ProfileInfo`。

### GET `/mirror/stats`

获取五维扫描数据。

返回 `MirrorStatsResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| dimensions | List\<StatDimension\> | 五维数据 |
| sampleSize | Integer | 样本数 |
| calculatedAt | String | 计算时间 |

`StatDimension`：`key`, `label`, `value`（0-100）, `desc`

---

## 语音模块 `/voice`

### GET `/voice/catalog`

获取音色目录（按分类分组）。

返回 `Result<JsonNode>`，结构为分类列表，每项含音色列表。

### GET `/voice/preview`

试听音色样本。返回 MP3 音频流。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| file | String | 是 | 音色文件名 |

---

## 存储模块 `/storage`

### GET `/storage/presign`

获取阿里云 OSS 预签名上传 URL。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| contentType | String | 是 | MIME 类型（如 image/jpeg） |

返回 `PresignUrlResp`：

| 字段 | 类型 | 说明 |
|---|---|---|
| uploadUrl | String | 预签名 PUT URL |
| accessUrl | String | 上传后的公开访问 URL |
| objectKey | String | OSS 对象键 |

---

## TTS 模块 `/tts`

### GET `/tts/audio`

文本转语音。返回 MP3 音频流。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| text | String | 是 | 文本（最长 200 字符） |
| voice | String | 否 | Edge TTS 音色名 |
| voiceId | String | 否 | 音色 ID（查找完整配置） |
