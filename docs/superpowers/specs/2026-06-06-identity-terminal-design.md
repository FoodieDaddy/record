# 身份终端（Identity Terminal）设计文档

## 概述

将 `miniprogram/pages/profile/` 从「个人中心」重构为「身份终端」，统一房间/灵感/镜像的赛博终端设计语言。同时后端新增身份等级系统和人格稳定度计算。

## 范围

- **In scope**：profile 页面全面重构 + 后端新增 `GET /user/identity-level` 接口 + 新配色方案
- **Out of scope**：score-records 页面（后续单独处理）、settings 页面、其他 Tab 页面配色迁移

## 配色方案（全站统一，本次仅 profile 页面生效）

```css
--primary: #00AFFF;
--bg: #05070A;
--card-bg: #0A0F18;
--card-border: rgba(0,170,255,0.15);
--glow: rgba(0,170,255,0.3);
--success: #36FF74;
--danger: #FF4D4F;
--text-secondary: #7C8698;
--card-radius: 18rpx;
```

---

## 后端设计

### 1. 新增表 `user_identity_level`

```sql
CREATE TABLE user_identity_level (
  user_id    BIGINT PRIMARY KEY COMMENT '用户ID',
  level      INT NOT NULL DEFAULT 1 COMMENT '等级 1-5',
  exp        INT NOT NULL DEFAULT 0 COMMENT '经验值',
  stability  INT DEFAULT NULL COMMENT '人格稳定度 0-100',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(user_id)
) COMMENT '用户身份等级';
```

### 2. 等级规则

| 等级 | 名称 | 解锁条件 |
|---|---|---|
| Lv.1 | 新人观察员 | 默认 |
| Lv.2 | 桌面参与者 | 对局数 ≥ 5 |
| Lv.3 | 策略执行者 | 对局数 ≥ 20 且累计积分 ≥ 100 |
| Lv.4 | 局势掌控者 | 对局数 ≥ 50 且胜率 ≥ 50% |
| Lv.5 | 法雷达候选者 | 对局数 ≥ 100 且 MBTI 已校准 |

经验值 = 对局数 × 10 + 净积分 × 1 + MBTI校准加成 200

### 3. 稳定度计算

- 取最近 20 场净得分的标准差 σ
- stability = clamp(round(100 - σ * 2.0), 0, 100)
- σ 越低 → 稳定度越高（σ=0 → 100分，σ=50 → 0分）
- N < 3 时返回 null（数据不足）

### 4. 接口设计

**`GET /user/identity-level`**

响应：
```json
{
  "level": 2,
  "title": "桌面参与者",
  "exp": 280,
  "nextLevelExp": 500,
  "progress": 56,
  "stability": 72
}
```

- `progress`：当前等级进度百分比 0-100
- `stability`：null 表示数据不足

**更新时机**：settle 归档时异步重算（复用 asyncExecutor 虚拟线程池）

### 5. 新增文件

| 文件 | 说明 |
|---|---|
| `entity/UserIdentityLevel.java` | 实体类 |
| `mapper/UserIdentityLevelMapper.java` | MyBatis Mapper |
| `service/IdentityLevelService.java` | 接口 |
| `service/impl/IdentityLevelServiceImpl.java` | 实现（含等级规则 + 稳定度计算） |
| `controller/UserController.java` | 新增 `GET /user/identity-level` 端点 |
| `dto/user/IdentityLevelResp.java` | 响应 DTO |
| `resources/sql/migration_identity_level.sql` | 建表 SQL |

---

## 前端设计

### 页面结构（从上到下 9 个模块）

#### 0. SYSTEM STATUS

- 保持 SYSTEM STATUS + ONLINE 文案
- 绿色状态点增加 2 秒呼吸动画（已有 breathe keyframe，确认生效即可）

#### 1. PLAYER PROFILE

结构：
```
PLAYER PROFILE  玩家身份档案
━━━━━━━━━━━━━━━━━━━━━━━━━━
头像 | 昵称  [NEWBIE 徽章]
     | PLAYER-0193
━━━━━━━━━━━━━━━━━━━━━━━━━━
加入时间        累计对局
12 Days         5 Matches
━━━━━━━━━━━━━━━━━━━━━━━━━━
状态  ● ACTIVE
```

- 昵称右侧增加身份等级徽章（胶囊标签，根据 level 显示对应文案）
- 底部 meta 行增加状态指示

#### 2. DATA MATRIX

4 宫格矩阵布局：
```
DATA MATRIX  数据矩阵
┌──────────┬──────────┐
│ NET YIELD│ WIN RATE │
│   -143   │    0%    │
├──────────┼──────────┤
│ MATCHES  │STABILITY │
│    1     │    --    │
└──────────┴──────────┘
```

- 净收益为负显示红色，为正显示绿色
- 稳定度 null 时显示 "--"
- 每格：英文标签（小写 muted）+ 大号数字 + 中文副标签

#### 3. IDENTITY LEVEL（新增模块）

```
IDENTITY LEVEL  身份等级
━━━━━━━━━━━━━━━━━━━━━━━━━━
Lv.2  桌面参与者
████████░░░░░░░░  56%
EXP 280 / 500
━━━━━━━━━━━━━━━━━━━━━━━━━━
[新人观察员] [桌面参与者] [策略执行者]
  ✓ 已解锁     ● 当前      锁定
```

- 等级进度条：蓝色填充，暗色底
- 下方显示等级路线图（横向 5 个节点：已解锁=蓝色实心、当前=脉冲动画、未解锁=灰色）
- 进度条动画（reduce-motion 时跳过）

#### 4. PERSONA PROTOCOL

```
PERSONA PROTOCOL  人格协议
━━━━━━━━━━━━━━━━━━━━━━━━━━
INTJ    冷静型控场者
        [SYNCED 已同步]
━━━━━━━━━━━━━━━━━━━━━━━━━━
偏差监测    LOCKED
数据来源    MBTI + 战绩镜像
━━━━━━━━━━━━━━━━━━━━━━━━━━
[策略型] [冷静] [独立] [长期主义]
```

- 标签改为发光胶囊标签（蓝色边框 + 弱蓝底）
- 同步状态 badge 保留绿色
- 偏差监测显示 LOCKED（后续可扩展）

#### 5. IDENTITY SUMMARY

```
IDENTITY SUMMARY  身份摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━
INTJ  冷静型控场者
━━━━━━━━━━━━━━━━━━━━━━━━━━
擅长  风险控制、长期规划、逆风运营
警惕  情绪波动、过度保守
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ 样本不足，结论仅供参考
```

- 终端报告样式，分隔线用 `━`
- 擅长/警惕标签保持绿色/橙色胶囊
- 当 matchCount < 3 时显示「样本不足，结论仅供参考」警告

#### 6. BADGE COLLECTION

保持横向滚动徽章，微调视觉：
- 徽章图标增加弱发光效果
- 已解锁徽章增加蓝色光晕

#### 7. ARCHIVES

改为独立卡片列表（不再是 2x2 grid）：
```
ARCHIVES  档案库
━━━━━━━━━━━━━━━━━━━━━━━━━━
[icon] 积分记录          >
       查看全部积分流水

[icon] 房间历史          >
       查看历史对局

[icon] 战绩档案          >
       查看个人战绩

[icon] 数据导出          >
       导出全部身份数据
```

- 每个卡片独立一行，左侧发光图标 + 标题 + 描述，右侧箭头
- 卡片间距 16rpx，hover 时背景微亮

#### 8. SYSTEM CONTROL

```
SYSTEM CONTROL  系统控制
━━━━━━━━━━━━━━━━━━━━━━━━━━
设置中心    SYSTEM SETTINGS    >
通知中心    NOTIFICATION       >
声音配置    AUDIO CONFIG       >
关于系统    ABOUT SYSTEM       >
```

- 每行左侧中文 + 右侧英文副标签 + 箭头
- 英文使用小号 muted 色

#### 9. TERMINATE SESSION

```
[  TERMINATE SESSION  ]
[    结束会话          ]
```

- 红色描边按钮，黑底
- `border: 1rpx solid rgba(255,77,79,0.24)`
- active 时微红光背景

---

## 数据流

```
onShow()
  ├── loadUserInfo()        → /user/me         → 头像/昵称/玩家代号/加入天数
  ├── loadMirrorData()      → /mirror/profile   → MBTI/特质/战斗人格
  ├── loadScoreStats()      → /score/trend      → 积分/胜率/对局数
  └── loadIdentityLevel()   → /user/identity-level → 等级/经验/稳定度
```

4 个请求并行加载，互不依赖。

---

## 文件变更清单

### 后端（新增）
- `backend/src/main/java/com/smartrecord/entity/UserIdentityLevel.java`
- `backend/src/main/java/com/smartrecord/mapper/UserIdentityLevelMapper.java`
- `backend/src/main/java/com/smartrecord/service/IdentityLevelService.java`
- `backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java`
- `backend/src/main/java/com/smartrecord/dto/user/IdentityLevelResp.java`
- `backend/src/main/resources/sql/migration_identity_level.sql`

### 后端（修改）
- `backend/src/main/java/com/smartrecord/controller/UserController.java` — 新增端点
- `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java` — settle 时触发等级重算

### 前端（修改）
- `miniprogram/pages/profile/profile.js` — 新增 loadIdentityLevel、等级映射逻辑
- `miniprogram/pages/profile/profile.wxml` — 全量重写模板
- `miniprogram/pages/profile/profile.wxss` — 全量重写样式（新配色 + 新布局）

### 前端（可能新增）
- `miniprogram/utils/identity-level.js` — 等级映射常量（如果逻辑复杂则抽取）
