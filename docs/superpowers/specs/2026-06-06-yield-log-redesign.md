# 积分流水终端 UI 重构设计文档

## 目标

将「积分记录」页面从普通记录列表重构为与镜像页、灵感页、身份终端一致的赛博终端风格。

## 方案

**方案 A：新聚合 API + 前端全量重构**

### 后端：`GET /score/yield-log`

新增端点，一次返回全部数据：

```json
{
  "netYield": -143,
  "sampleCount": 1,
  "curveUnlockCount": 2,
  "curveData": [
    { "roomId": "xxx", "date": "2026-06-06", "netScore": -143 }
  ],
  "records": [
    {
      "roomId": "HGEWRT",
      "settledAt": "2026.06.06 02:03",
      "myScore": -143,
      "players": [
        { "nickname": "摆烂的铁公鸡", "avatar": "...", "score": -143, "isMe": true },
        { "nickname": "先天话痨", "avatar": "...", "score": 143, "isMe": false }
      ]
    }
  ]
}
```

**新增文件：**
- `YieldLogResp.java` — 响应 DTO（内部类 Point, Record, Player）
- `ScoreController.getYieldLog()` — 端点
- `ScoreServiceImpl.getYieldLog()` — 聚合逻辑

**聚合逻辑：**
1. `roomMemberMapper.selectTrendByUserId(userId, 20)` 获取趋势点
2. `roomMemberMapper.selectHistoryByUserId(userId)` 获取历史房间
3. `netYield` = 所有 netScore 求和
4. `sampleCount` = trend 点数
5. `curveUnlockCount` = 2（固定值）
6. `settledAt` 格式化为 `yyyy.MM.dd HH:mm`
7. 遍历 rooms → members，标记 `isMe`

### 前端：yield-chart 组件

新建 `/components/yield-chart/`，基于 trend-chart 定制：

| 属性 | 值 |
|---|---|
| 背景 | `#0A0F18` |
| 曲线 | `#00AFFF` |
| 负收益区域 | `rgba(255,77,79,0.15)` 渐变 |
| 正收益区域 | `rgba(0,175,255,0.10)` 渐变 |
| 节点 | 蓝色发光点 |
| 网格线 | `rgba(255,255,255,0.05)` |

### 前端：score-records 页面重写

**数据流：** `onShow` → `GET /score/yield-log` → 一次 setData

**页面结构：**
1. 终端标题：`NET YIELD LOG / 积分流水`
2. 收益摘要卡：`NET YIELD` + 净收益数字（正绿 `#36FF74` / 负红 `#FF4D4F` / 零白）
3. 采样状态：`SAMPLE STATUS` + 进度 `1/2`
4. 曲线区域：sampleCount < 2 → 锁定卡 `CURVE LOCKED`；≥ 2 → `<yield-chart>`
5. 对局记录：`MATCH LOG` + 卡片列表
6. 空状态：`NO MATCH DATA` 终端风

**卡片细节：**
- `ROOM {roomNo}` 左侧 + `YYYY.MM.DD HH:mm` 右侧
- `MATCH RESULT / 对局结果`
- 当前行标「我」标签，对手行标「对手」
- 分数右对齐，正绿负红
- 底部 `VIEW MATCH DOSSIER / 查看对局档案` HUD 按钮
- 整个卡片可点击跳 settle 页

**样式统一：** 镜像页风格——`#0A0F18` 卡片底、`rgba(0,175,255,0.12)` 边框、`18rpx` 圆角、kicker 中英文标题模式

## 验收标准

1. 页面不再大面积空白
2. 数据采样不足状态改为终端锁定状态
3. 样本不足时不显示空折线图
4. 对局卡片时间格式正常（YYYY.MM.DD HH:mm）
5. 当前用户有「我」标签
6. 分数右对齐，正负色明确
7. 查看对局档案入口明显且可点击
8. 页面视觉与身份终端、镜像页、灵感页保持一致
