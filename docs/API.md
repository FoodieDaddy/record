# 接口文档

前端已依赖的核心接口契约参考，非 OpenAPI 全量规范。工程代号、包名、表名、路径保留 smartrecord、room、score、transfer 等既有命名。

## 通用约定

### 返回结构

```json
{ "code": 200, "message": "success", "data": {} }
```

- `code = 200` 成功；`code != 200` 业务错误，`message` 可展示
- `code = 409` 幂等冲突
- 分页：`PageResult<T>` → `{ "total": N, "records": [] }`

### 幂等性

转分、封存、本局录提交/确认支持幂等。前端传 `clientRequestId`（建议 `时间戳-随机数`），后端 Redis SETNX 去重。未传时不做幂等检查。

### WebSocket

- 端点：`/ws/score`，认证通过 `Sec-WebSocket-Protocol` 传 token
- 按编队广播，`PRESENCE_UPDATE` 推送在线成员 ID 列表

---

## 用户模块 `/user`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/user/login` | 否 | 微信登录，传 `code`(必填)、`nickname`/`avatarUrl`(选填)，返回 `token`/`userId`/`nickname`/`avatarUrl` |
| GET | `/user/me` | 是 | 当前用户信息，含 `userDetail` |
| PUT | `/user/me` | 是 | 更新呼号/徽标，传 `nickname`(≤12字)/`avatarUrl` |
| GET | `/user/detail` | 是 | 用户设置：`voiceEnabled`/`voiceId`/`animEnabled`/`vibrateEnabled` |
| PUT | `/user/detail` | 是 | 更新用户设置 |
| GET | `/user/identity-level` | 是 | 授权等级：`level`(1-5)/`title`/`exp`/`progress`/`stability` 等 |

---

## 编队模块 `/room`

> 产品层：「编队」= 任务编队，工程字段保留 `room`。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/room` | 是 | 创建编队，返回 `RoomResp` |
| POST | `/room/join` | 是 | 加入编队，传 `roomNo` 或 `scanRoomId` |
| GET | `/room/{roomId}` | 是 | 编队详情 |
| GET | `/room/my` | 是 | 当前用户编队列表 |
| DELETE | `/room/{roomId}/quit` | 是 | 退出编队（主控退出=解散） |
| GET | `/room/history` | 是 | 已封存的历史编队 |
| PUT | `/room/{roomId}/settings` | 是 | 主控更新设置 |

### 创建编队参数

| 字段 | 默认值 | 说明 |
|---|---|---|
| scoreMode | 1 | 1=脉冲流向，2=航段写入 |
| roundInputMethod | 1 | 1=主控填写，2=成员自填 |
| trustMode | 1 | 0=标准协议，1=快速协议 |
| zeroSumRequired | 1 | 0=自由封存，1=零和封存 |
| autoTimeoutSeconds | 30 | 自动超时秒数 |
| autoTimeoutAction | 1 | 1=自动同意，2=自动取消 |

### RoomResp

`roomId`, `roomNo`(6位), `ownerId`, `scoreMode`, `status`(0进行中/1已封存), `qrCodeUrl`, `members`(List\<MemberVO\>), `createdAt`

`MemberVO`：`userId`, `nickname`, `avatarUrl`, `finalScore`

### 更新设置参数

`roundInputMethod`, `trustMode`, `zeroSumRequired`, `autoTimeoutSeconds`, `autoTimeoutAction`（同创建参数）

---

## 记分模块 `/score`

> 工程层 `score`=脉冲，`transfer`=脉冲流向，`settle`=封存航程。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/score/transfer` | 是 | 自由流转记分，支持幂等 |
| GET | `/score/room/{roomId}/transfer-amount-suggestions` | 是 | 常用数值推荐 |
| POST | `/score/room/{roomId}/settle` | 是 | 主控封存，支持幂等 |
| GET | `/score/trend` | 是 | 净数值趋势（`limit` 默认20，最大50） |
| GET | `/score/yield-log` | 是 | 航迹档案摘要与航程记录 |
| GET | `/score/room/{roomId}/chart` | 是 | 编队脉冲轨迹折线图 |
| GET | `/score/room/{roomId}/insight` | 是 | 编队洞察 |
| GET | `/score/room/{roomId}/network` | 是 | 脉冲关系网络图 |

### 流转记分参数

`roomId`(必填), `toUserId`(必填), `amount`(必填,≥1), `remark`, `clientRequestId`。返回 `TransferScoreResp`（含 `fromUser`/`toUser`/`amount`/`amountDisplay`/`remark`/`createdAt`）。

### 推荐数值

返回 `items`(≤6)，每项含 `amount`/`source`（crew/space/random）/`label`，`fallback` 表示是否随机补齐。

### 封存

传 `clientRequestId`。返回 `SettleResp`：`roomId`, `roomNo`, `timestamps`, `series`, `memberScores`, `autoSettled`。

### 趋势点 / 曲线点

`roomId`, `date`, `netScore`

### 航迹档案

`netYield`, `sampleCount`, `curveUnlockCount`, `curveData`(List\<CurvePoint\>), `records`(List\<YieldRecord\>)

`YieldRecord`：`roomId`, `roomNo`, `settledAt`, `myScore`, `myRank`, `memberCount`

### 图表数据

`timestamps`(ms), `series`(List\<Series\>，每项含 `userId`/`nickname`/`scores`)

### 洞察

`totalTransfer`, `maxSingleTransfer`, `mostActiveUser`, `transferCount`, `networkDensity`(HIGH/MEDIUM/LOW)

### 网络图

`nodes`(`userId`/`nickname`/`avatarUrl`/`score`), `links`(`from`/`to`/`netAmount`/`count`)

---

## 本局录入模块 `/round`

> 产品层展示名：航段写入

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/round/start` | 是 | 主控发起，返回 `RoundRecordResp` |
| POST | `/round/submit` | 是 | 提交读数，支持幂等 |
| POST | `/round/confirm` | 是 | 确认/驳回读数，支持幂等 |
| POST | `/round/cancel` | 是 | 主控取消待录入记录 |
| GET | `/round/pending` | 是 | 获取待处理录入 |

### RoundRecordResp

`id`, `roomId`, `status`(1待录入/2待确认/3已生效/4已驳回/5已取消), `inputMethod`, `trustMode`, `zeroSumRequired`, `createdBy`, `totalScore`, `details`(List\<DetailVO\>), `memberSubmitted`/`memberTotal`, `confirmCount`/`confirmTotal`, `createdAt`

`DetailVO`：`userId`, `nickname`, `avatarUrl`, `score`, `submitted`, `confirmed`

### 提交参数

`roomId`(必填), `scores`(List, 每项含 `userId`/`score`), `clientRequestId`

### 确认参数

`roomId`(必填), `agree`(Boolean 必填), `clientRequestId`

---

## 导航核心模块 `/fortune`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/fortune/today` | 是 | 今日指令投影 |

参数：`force`(Boolean, 默认 false)。后端 LLM 最长 25s，前端 timeout 设 28~30s。

返回 `FortuneResp`：`verdict`, `buffs`(List\<String\>), `debuffs`(List\<String\>), `themeColor`, `glowColor`, `tag`, `userTag`, `source`(llm/fallback), `lunarDate`, `solarTerm`, `title`, `subtitle`, `tags`, `nextRefreshAt`, `nextRefreshAtEpochMs`

---

## 镜像模块 `/mirror`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/mirror/profile` | 是 | 镜像投影（MBTI + 行为画像） |
| POST | `/mirror/profile/refresh` | 是 | 刷新行为画像，返回同上 |
| POST | `/mirror/mbti/test` | 是 | 提交 20 题 MBTI 测试 |
| POST | `/mirror/mbti/direct` | 是 | 直填 MBTI 编号 |
| GET | `/mirror/stats` | 是 | 全息扫描数据 |

### MirrorProfileResp

`mbti`(ProfileInfo), `battlePersona`(BattlePersonaInfo), `dimensions`(List\<DimensionInfo\>), `reading`(ReadingInfo), `traits`(List\<String\>), `personaMatch`(PersonaMatchInfo), `personaConfidence`(0-100)

- `ProfileInfo`：`calibrated`, `mbtiCode`, `confidence`, `mbtiSource`(test/direct), `calibratedAt`
- `BattlePersonaInfo`：`generated`, `sampleSize`, `sampleRange`, `tag`, `title`, `summary`, `calculatedAt`
- `DimensionInfo`：`key`, `label`, `value`(0-100), `desc`
- `ReadingInfo`：`available`, `text`, `observation`, `deviation`, `risk`, `growthAdvice`
- `PersonaMatchInfo`：`available`, `matchPercentage`, `prediction`, `actualSummary`, `summary`, `inferredMbtiType`, `inferredMbtiTitle`, `deviationPercent`

### MBTI 测试参数

`testVersion`(必填), `answers`(List，每项含 `questionId`/`dimension`(E_I等)/`score`(1/-1/0))

### 直填参数

`mbtiCode`(Integer, 1-16)

### 全息扫描

`dimensions`(List\<StatDimension\>), `sampleSize`, `calculatedAt`。`StatDimension`：`key`/`label`/`value`(0-100)/`desc`

---

## 语音模块 `/voice`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/voice/catalog` | 否 | 音色目录（按分类分组） |
| GET | `/voice/preview` | 否 | 试听音色，传 `file`，返回 MP3 流 |

---

## 存储模块 `/storage`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/storage/presign` | 是 | 预签名上传 URL |

参数：`contentType`(必填), `contentLength`(选填)。根据 `storage.provider` 返回不同：

| provider | uploadUrl | accessUrl | 说明 |
|---|---|---|---|
| aliyun | 预签名 PUT URL | 公开访问 URL | 前端直传 OSS |
| cloudbase | 空 | 空 | 前端用 `wx.cloud.uploadFile` |
| cos | 预留 | — | 后期实现 |

返回：`uploadUrl`, `accessUrl`, `objectKey`, `provider`

---

## TTS 模块 `/tts`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/tts/audio` | 否 | 文本转语音，返回 MP3 流 |

参数：`text`(必填,≤200字), `voice`(Edge TTS 音色名), `voiceId`(音色 ID)
