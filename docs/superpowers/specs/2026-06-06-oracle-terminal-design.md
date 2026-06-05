# Oracle Terminal — 策略灵感终端完整重写设计

> 日期：2026-06-06
> 范围：前端 fortune 页面完整重写 + 后端 FortuneResp 扩展
> 决策：后端返回卡牌原型 / 后端返回 nextRefreshAt / 保留 GET /fortune/today

---

## 1. 页面定位

策略灵感终端。每日一次策略生成，结合人格协议、战绩镜像、历史行为，输出今日行动建议，生成可分享的策略档案。

**不做**：塔罗占卜、运势抽签、普通卡牌游戏、AI 聊天分析。
**要做**：策略推演终端、博弈建议系统、每日行动协议。

---

## 2. 状态机

```
idle → generating → success → poster_generating → poster_preview → error
                                                    ↑
                                                    └── 返回 success
```

| 状态 | 触发 | 页面表现 |
|------|------|----------|
| `idle` | 页面加载且无今日缓存 | 中央策略卡 + "点击抽取" + 下次刷新时间 |
| `generating` | 用户点击抽取 / 缓存过期 | 扫描环 + 终端日志 + 4 阶段进度 + 超时提示 |
| `success` | API 返回成功 | 策略卡展示 + 标签 + 优势/风险 + 按钮 |
| `poster_generating` | 点击"分享策略卡" | "GENERATING DOSSIER..." 进度条 |
| `poster_preview` | Canvas 渲染完成 | 海报预览 + 保存/分享/关闭 |
| `error` | API 失败 / 超时 | 错误信息 + 重试按钮 |

---

## 3. 后端改动

### 3.1 FortuneResp 新增字段

```java
// 新增字段，向后兼容（旧前端忽略新字段）
private String title;        // 卡牌中文名，如"压制者"
private String subtitle;     // 卡牌英文名，如"THE DOMINATOR"
private List<String> tags;   // 策略标签，如["强势","连续","压制"]
private String nextRefreshAt; // 下次可刷新时间，ISO 格式 "HH:mm:ss"，null 表示今日已生成
```

### 3.2 卡牌原型决定逻辑

在 `FortuneServiceImpl` 中，根据 `UserTag` 从预定义原型池中选取卡牌（LLM 不参与卡牌选择）：

- 新增 `TACTICAL_ARCHETYPES` 映射：`UserTag → List<Archetype>`
- 每个 Archetype 包含 `title`, `subtitle`, `keywords`
- 根据 `UserTag` 从对应池中随机选一个（种子可用当日日期保证当日一致）
- LLM 只负责 verdict/buffs/risks 内容，不返回卡牌元信息

### 3.3 nextRefreshAt 计算

- 从 Redis TTL 推算：`TTL("sr:fortune:{uid}:{date}")` → 当前时间 + TTL 秒数
- 若 TTL 已过期或 key 不存在，返回 null
- 前端收到 null 时显示"今日策略已生成"

### 3.4 接口不变

保留 `GET /fortune/today?force=true`，只扩展返回结构。

---

## 4. 前端重写

### 4.1 文件结构

```
miniprogram/pages/fortune/
  fortune.js      — 完整重写，6 状态机 + Canvas 海报
  fortune.wxml    — 完整重写，5 个条件渲染屏
  fortune.wxss    — 完整重写，新配色系统
  fortune.json    — 不变
```

### 4.2 状态机实现

```javascript
data: {
  phase: 'idle', // idle | generating | success | poster_generating | poster_preview | error
  strategy: null,      // FortuneResp 结果
  nextRefreshAt: '',   // "HH:mm:ss"
  countdownText: '',   // "02:15:30"
  // generating 状态
  logs: [],            // 终端日志行
  step: 0,            // 当前阶段 1-4
  timeoutLevel: 'normal', // normal | slow | long
  // poster 状态
  posterPath: '',      // Canvas 生成的临时文件路径
  posterError: '',
}
```

### 4.3 各屏设计

#### idle 屏

```
SMART RECORD · STRATEGY
[ 日期 + 农历 ]

今日策略

[中央策略卡 — 暗色描边，呼吸动效]
[外圈扫描环 — 低速旋转]

点击抽取

系统将结合：
人格协议 · 战绩镜像 · 历史行为

下一次策略更新：20:30:43
```

- 点击卡片区域或"点击抽取"文字 → 进入 generating
- 卡片轻微上浮 + 外圈扫描环扩散

#### generating 屏

```
[中央策略卡 — 呼吸 + 扫描环]

正在推演今日策略
系统正在结合人格协议与历史行为模型

推演阶段：
✓ 人格协议同步
✓ 战绩镜像分析
… 策略向量构建
· 生成最终建议

[终端日志区]
[SCAN] 读取人格协议...
[SCAN] 读取战绩镜像...
[ANALYSIS] 构建策略向量...

2 / 4
```

超时处理：
- 0-2s：正常扫描动画
- 2-5s：显示终端日志
- 5-10s："推演仍在进行，请稍候"
- 10s+："推演耗时较长" + [继续等待] [重新推演] 按钮

#### success 屏

```
SMART RECORD · STRATEGY
[ 日期 ]

今日策略

[策略卡 — 根据 glowColor 渲染边框色]

压制者
THE DOMINATOR

核心建议：
平稳是最好的基底，细水长流。

[强势] [连续] [压制]

行动优势：
+ 心态平稳如水
+ 节奏稳定输出
+ 持续高效作战

风险提示：
- 缺乏爆发力
- 注意抓住转瞬机会

[重新抽取]  [分享策略卡]
```

- 重新抽取：灰色描边，点击前二次确认弹窗
- 分享策略卡：蓝色描边 + 轻微发光，点击进入 poster_generating

#### poster_generating 屏

弹窗覆盖层：
```
GENERATING DOSSIER...
[进度条动画]
```

#### poster_preview 屏

弹窗覆盖层：
```
[海报图片预览 — 1080x1440]

[保存图片]  [分享微信]  [关闭]
```

海报内容结构：
```
SMART RECORD
STRATEGY DOSSIER

[ 日期 ]

[核心图形 — 卡牌图标大号]

博弈者
THE GAMBLER

平稳是最好的基底，细水长流。

#变通  #灵活  #博弈

────────────

扫码进入 Smart Record
[二维码]
```

#### error 屏

```
策略推演失败
系统暂时无法生成今日策略

[重试]  [返回]
```

### 4.4 配色系统

```css
/* 全局 */
--bg-page: #05070A;
--bg-card: #0A0F18;
--border-primary: rgba(0, 175, 255, 0.25);
--border-inner: rgba(0, 175, 255, 0.12);
--glow-primary: rgba(0, 175, 255, 0.30);

/* 文字 */
--text-main: #FFFFFF;
--text-secondary: #7C8698;
--text-muted: rgba(255, 255, 255, 0.38);

/* 状态色 */
--color-primary: #00AFFF;
--color-success: #36FF74;
--color-danger: #FF4D4F;
--color-warning: #FFAA33;
```

### 4.5 Canvas 海报规格

- 尺寸：1080 × 1440（3:4 比例）
- 背景：#05070A
- 卡片底：#0A0F18
- 主边框：#00AFFF 25% 透明度
- 文字：白色，副标题 #7C8698
- 二维码：必须清晰可见，尺寸 ≥ 200×200px
- 导出：`wx.canvasToTempFilePath` 2x 分辨率

### 4.6 分享修复

当前问题：点击"分享策略卡"无反应。

修复方案：
1. 点击立即显示 poster_generating 状态（"GENERATING DOSSIER..."）
2. Canvas 渲染完成 → 进入 poster_preview
3. 渲染失败 → 显示错误 + [重试] [取消]
4. 禁止点击后无任何反馈

---

## 5. 文案规范

| 位置 | 文案 | 备注 |
|------|------|------|
| idle 标题 | 今日策略 | 不用"抽取""占卜" |
| idle 副标题 | 系统将结合：人格协议 · 战绩镜像 · 历史行为 | |
| idle 刷新 | 下一次策略更新：{time} | 不用"状态刷新于" |
| generating 标题 | 正在推演今日策略 | |
| generating 副标题 | 系统正在结合人格协议与历史行为模型 | |
| success 核心建议 | 20-36 字 | 冷静克制，不玄学 |
| success 优势 | 最多 3 条，"+ " 前缀 | |
| success 风险 | 最多 2 条，"- " 前缀 | |
| poster 标题 | SMART RECORD · STRATEGY DOSSIER | |
| 超时 5s | 推演仍在进行，请稍候 | |
| 超时 10s | 推演耗时较长，可继续等待或重新发起 | |
| 重新抽取确认 | 今日策略已生成，重新抽取将覆盖当前结果。 | |

---

## 6. 敏感词过滤

所有 LLM 输出必须经过敏感词过滤。命中时丢弃结果，使用 fallback。

禁用词：棋牌、赌博、赌、下注、押注、筹码、牌局、牌桌、打牌、麻将、扑克、德州、梭哈、赢钱、赚钱、发财、稳赚、必胜、翻本、追损、运势、算命、占卜、塔罗、抽牌、神谕、卦象、黄历、风水、开运、转运、改运、预测输赢、胜率提升。

替换：牌局→对局/回合/场景、筹码→积分、输赢→结果波动/反馈、运势→今日状态/今日策略。

---

## 7. 动画约束

允许：
- 卡片轻微呼吸（`cardBreathe`，3s 循环）
- 外圈扫描环低速旋转（`scanRotate`，8s 循环）
- 终端日志逐行出现（1200ms 间隔）
- 按钮按压反馈
- 海报生成进度条滑动

禁止：
- 大幅旋转
- 高频闪烁
- 复杂粒子
- 持续强发光

所有动画必须支持 `reduce-motion`：绑定 `class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}"`。

---

## 8. 验收标准

1. [ ] idle 页点击中央卡片可进入 generating 状态
2. [ ] generating 状态显示 4 阶段进度，不允许只有卡片旋转
3. [ ] generating 超过 5 秒显示等待提示
4. [ ] generating 超过 10 秒显示继续等待/重新推演按钮
5. [ ] success 页展示后端返回的 title/subtitle/tags/verdict/buffs/risks
6. [ ] "分享策略卡"点击后必须有反应（进入 poster_generating）
7. [ ] 海报预览页的保存图片、分享微信、关闭三个按钮可用
8. [ ] 海报文字清晰，比例 3:4（1080×1440）
9. [ ] 下一次刷新时间文案正确显示
10. [ ] 重新抽取前有二次确认弹窗
11. [ ] 所有页面使用统一配色（#05070A 底，#00AFFF 主色）
12. [ ] reduce-motion 下所有动画静默
13. [ ] 后端 FortuneResp 新增字段向后兼容

---

## 9. 涉及文件

### 后端
- `backend/src/main/java/com/smartrecord/dto/fortune/FortuneResp.java` — 新增 title/subtitle/tags/nextRefreshAt
- `backend/src/main/java/com/smartrecord/service/impl/FortuneServiceImpl.java` — 卡牌原型选择 + nextRefreshAt 计算

### 前端
- `miniprogram/pages/fortune/fortune.js` — 完整重写
- `miniprogram/pages/fortune/fortune.wxml` — 完整重写
- `miniprogram/pages/fortune/fortune.wxss` — 完整重写
