# Battle Report 结算页全面重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将结算页从"统计报表"升级为"战局报告终端"，统一全 APP 赛博终端设计语言，使结算页成为房间与镜像系统之间的数据桥梁。

**Architecture:** 前端重构 settle 页面和 room 内结算弹层，新增 4 个专属组件（battle-summary / score-network / battle-insight / persona-signal）；后端修复 insight/network 端点的 MySQL 回退逻辑，使已结算房间也能返回完整数据。复用现有 `force-graph` 和 `score-chart` 组件。

**Tech Stack:** 微信小程序原生 (WXML/WXSS/JS)、Canvas 2D、Spring Boot 3.2.5、Redis + MySQL

---

## File Structure

### 新建文件
| 文件 | 职责 |
|---|---|
| `miniprogram/components/battle-summary/battle-summary.*` | 战局总结四宫格（赢家/输家/最大单笔/总流转） |
| `miniprogram/components/score-network/score-network.*` | 积分关系网络（封装 force-graph + 节点详情弹窗） |
| `miniprogram/components/battle-insight/battle-insight.*` | 战局洞察面板（活跃度/关注度/竞争强度） |
| `miniprogram/components/persona-signal/persona-signal.*` | 人格信号采集预览（4 维度 + 同步状态） |

### 修改文件
| 文件 | 改动 |
|---|---|
| `backend/.../service/impl/ScoreServiceImpl.java` | `getRoomInsight` / `getRoomNetwork` 增加 MySQL 回退 |
| `miniprogram/pages/settle/settle.js` | 重写 loadData，新增 insight/network/persona 数据加载 |
| `miniprogram/pages/settle/settle.wxml` | 全面重写为战局报告终端布局 |
| `miniprogram/pages/settle/settle.wxss` | 全面重写为赛博终端风格 |
| `miniprogram/pages/settle/settle.json` | 注册新组件 |
| `miniprogram/pages/room/room.js` | `showSettleFromResp` / `fetchAndShowSettle` 增加新数据 |
| `miniprogram/pages/room/room.wxml` | 结算弹层全面重写 |
| `miniprogram/pages/room/room.wxss` | 结算弹层样式全面重写 |
| `miniprogram/pages/room/room.json` | 注册新组件 |
| `miniprogram/components/score-chart/score-chart.js` | 支持 eventMarkers 属性（标记关键积分事件） |

---

## Task 1: 后端 — insight/network 端点 MySQL 回退

**Problem:** `getRoomInsight` 和 `getRoomNetwork` 只读 Redis，settle 后 Redis 被清理，返回空数据。结算页需要这两个端点提供战局洞察和积分关系网络。

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java:749-860`

- [ ] **Step 1: 重构 getRoomInsight 增加 MySQL 回退**

当 Redis events 为空时，从 `room.allRecord` JSON 中提取 `transferEvents` 数组进行同样的计算。

```java
@Override
public RoomInsightResp getRoomInsight(Long roomId) {
    String eventsKey = ROOM_PREFIX + roomId + ":events";
    Set<String> events = redisTemplate.opsForZSet().range(eventsKey, 0, -1);

    // Redis 无数据时，从 MySQL allRecord 回退
    if (events == null || events.isEmpty()) {
        return getRoomInsightFromDb(roomId);
    }

    // ... 原有 Redis 逻辑不变 ...
}

private RoomInsightResp getRoomInsightFromDb(Long roomId) {
    Room room = roomMapper.selectById(roomId);
    if (room == null || room.getAllRecord() == null || room.getAllRecord().isEmpty()) {
        return RoomInsightResp.builder()
                .totalTransfer(0).maxSingleTransfer(0)
                .mostActiveUser(null).transferCount(0)
                .networkDensity("LOW").build();
    }

    int totalTransfer = 0;
    int maxSingle = 0;
    Map<Long, Integer> userCount = new HashMap<>();

    for (Map<String, Object> record : room.getAllRecord()) {
        Object te = record.get("transferEvents");
        if (!(te instanceof List)) continue;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> transfers = (List<Map<String, Object>>) te;
        for (Map<String, Object> evt : transfers) {
            long from = ((Number) evt.get("from")).longValue();
            long to = ((Number) evt.get("to")).longValue();
            int amount = ((Number) evt.get("amount")).intValue();
            totalTransfer += amount;
            if (amount > maxSingle) maxSingle = amount;
            userCount.merge(from, 1, Integer::sum);
            userCount.merge(to, 1, Integer::sum);
        }
    }

    RoomInsightResp.ActiveUser activeUser = null;
    if (!userCount.isEmpty()) {
        Map.Entry<Long, Integer> top = Collections.max(userCount.entrySet(), Map.Entry.comparingByValue());
        User user = userMapper.selectById(top.getKey());
        activeUser = RoomInsightResp.ActiveUser.builder()
                .userId(top.getKey())
                .nickname(user != null ? user.getNickname() : "未知")
                .avatarUrl(user != null ? user.getAvatarUrl() : null)
                .count(top.getValue()).build();
    }

    // 从 room_member 计算成员数
    int n = room.getAllRecord().stream()
            .flatMap(r -> {
                Object s = r.get("scores");
                return s instanceof List ? ((List<Map<String, Object>>) s).stream() : java.util.stream.Stream.empty();
            })
            .map(s -> ((Number) s.get("userId")).longValue())
            .collect(java.util.stream.Collectors.toSet()).size();

    int eventCount = userCount.values().stream().mapToInt(v -> v).sum() / 2;
    double density = (n > 1) ? (double) eventCount / (n * (n - 1)) : 0;
    String densityLevel = density > 0.3 ? "HIGH" : density > 0.1 ? "MEDIUM" : "LOW";

    return RoomInsightResp.builder()
            .totalTransfer(totalTransfer)
            .maxSingleTransfer(maxSingle)
            .mostActiveUser(activeUser)
            .transferCount(eventCount)
            .networkDensity(densityLevel).build();
}
```

- [ ] **Step 2: 重构 getRoomNetwork 增加 MySQL 回退**

同理，当 Redis 为空时从 `allRecord` 提取 `transferEvents` 构建 nodes/links。

```java
@Override
public RoomNetworkResp getRoomNetwork(Long roomId) {
    String eventsKey = ROOM_PREFIX + roomId + ":events";
    Set<String> events = redisTemplate.opsForZSet().range(eventsKey, 0, -1);
    String scoresKey = ROOM_PREFIX + roomId + ":scores";
    Set<ZSetOperations.TypedTuple<String>> scoreSet =
            redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1);

    // Redis 无数据时回退
    if ((events == null || events.isEmpty()) && (scoreSet == null || scoreSet.isEmpty())) {
        return getRoomNetworkFromDb(roomId);
    }

    // ... 原有 Redis 逻辑不变 ...
}

private RoomNetworkResp getRoomNetworkFromDb(Long roomId) {
    Room room = roomMapper.selectById(roomId);
    if (room == null || room.getAllRecord() == null) {
        return RoomNetworkResp.builder().nodes(List.of()).links(List.of()).build();
    }

    // 从 allRecord 提取成员最终分数
    Map<Long, Integer> finalScores = new LinkedHashMap<>();
    Map<Long, String> nicknames = new LinkedHashMap<>();
    for (Map<String, Object> record : room.getAllRecord()) {
        Object scoresObj = record.get("scores");
        if (!(scoresObj instanceof List)) continue;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> scores = (List<Map<String, Object>>) scoresObj;
        for (Map<String, Object> s : scores) {
            long uid = ((Number) s.get("userId")).longValue();
            int score = ((Number) s.get("score")).intValue();
            finalScores.merge(uid, score, Integer::sum);
            String name = (String) s.get("name");
            if (name != null) nicknames.putIfAbsent(uid, name);
        }
    }

    // 构建 nodes
    List<RoomNetworkResp.Node> nodes = new ArrayList<>();
    for (Map.Entry<Long, Integer> e : finalScores.entrySet()) {
        User user = userMapper.selectById(e.getKey());
        nodes.add(RoomNetworkResp.Node.builder()
                .userId(e.getKey())
                .nickname(user != null ? user.getNickname() : nicknames.getOrDefault(e.getKey(), "未知"))
                .avatarUrl(user != null ? user.getAvatarUrl() : null)
                .score(e.getValue()).build());
    }

    // 从 transferEvents 构建 links
    Map<String, int[]> pairMap = new HashMap<>();
    for (Map<String, Object> record : room.getAllRecord()) {
        Object te = record.get("transferEvents");
        if (!(te instanceof List)) continue;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> transfers = (List<Map<String, Object>>) te;
        for (Map<String, Object> evt : transfers) {
            long from = ((Number) evt.get("from")).longValue();
            long to = ((Number) evt.get("to")).longValue();
            int amount = ((Number) evt.get("amount")).intValue();
            String key = from + ":" + to;
            pairMap.merge(key, new int[]{amount, 1}, (a, b) -> { a[0] += b[0]; a[1] += b[1]; return a; });
        }
    }

    List<RoomNetworkResp.Link> links = new ArrayList<>();
    for (Map.Entry<String, int[]> e : pairMap.entrySet()) {
        String[] parts = e.getKey().split(":");
        links.add(RoomNetworkResp.Link.builder()
                .from(Long.parseLong(parts[0]))
                .to(Long.parseLong(parts[1]))
                .netAmount(e.getValue()[0])
                .count(e.getValue()[1]).build());
    }

    return RoomNetworkResp.builder().nodes(nodes).links(links).build();
}
```

- [ ] **Step 3: 验证编译通过**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java
git commit -m "feat(score): insight/network 端点增加 MySQL 回退，支持已结算房间查询"
```

---

## Task 2: 新建 battle-summary 组件（战局总结四宫格）

**Files:**
- Create: `miniprogram/components/battle-summary/battle-summary.js`
- Create: `miniprogram/components/battle-summary/battle-summary.wxml`
- Create: `miniprogram/components/battle-summary/battle-summary.wxss`
- Create: `miniprogram/components/battle-summary/battle-summary.json`

- [ ] **Step 1: 创建组件 JSON**

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建组件 JS**

```javascript
Component({
  properties: {
    winner: { type: Object, value: null },      // { nickname, finalScore }
    loser: { type: Object, value: null },        // { nickname, finalScore }
    maxSingle: { type: Number, value: 0 },
    totalTransfer: { type: Number, value: 0 },
    transferCount: { type: Number, value: 0 },
    memberCount: { type: Number, value: 0 },
    roomNo: { type: String, value: '' },
    settleTime: { type: String, value: '' }
  }
})
```

- [ ] **Step 3: 创建组件 WXML**

```xml
<view class="battle-summary">
  <!-- 顶部标题区 -->
  <view class="summary-header">
    <view class="summary-kicker">BATTLE REPORT</view>
    <view class="summary-title">战局复盘</view>
    <view class="summary-line"></view>
  </view>

  <!-- 房间信息条 -->
  <view class="summary-meta">
    <view class="meta-item" wx:if="{{roomNo}}">
      <text class="meta-label">房间</text>
      <text class="meta-value mono">{{roomNo}}</text>
    </view>
    <view class="meta-item" wx:if="{{settleTime}}">
      <text class="meta-label">结束</text>
      <text class="meta-value">{{settleTime}}</text>
    </view>
    <view class="meta-item" wx:if="{{memberCount}}">
      <text class="meta-label">成员</text>
      <text class="meta-value">{{memberCount}}人</text>
    </view>
  </view>

  <view class="summary-divider"></view>

  <!-- 四宫格数据块 -->
  <view class="summary-grid">
    <!-- 赢家 -->
    <view class="summary-cell" wx:if="{{winner}}">
      <text class="cell-kicker">本局赢家</text>
      <text class="cell-name">{{winner.nickname}}</text>
      <text class="cell-number positive">+{{winner.finalScore}}</text>
    </view>
    <!-- 输家 -->
    <view class="summary-cell" wx:if="{{loser}}">
      <text class="cell-kicker">最大输家</text>
      <text class="cell-name">{{loser.nickname}}</text>
      <text class="cell-number negative">{{loser.finalScore}}</text>
    </view>
    <!-- 最大单笔 -->
    <view class="summary-cell">
      <text class="cell-kicker">最大单笔</text>
      <text class="cell-number accent">{{maxSingle}}</text>
    </view>
    <!-- 总流转 -->
    <view class="summary-cell">
      <text class="cell-kicker">总流转积分</text>
      <text class="cell-number accent">{{totalTransfer}}</text>
    </view>
  </view>

  <!-- 底部统计条 -->
  <view class="summary-footer">
    <view class="footer-stat">
      <text class="footer-num">{{transferCount}}</text>
      <text class="footer-label">流转次数</text>
    </view>
    <view class="footer-dot"></view>
    <view class="footer-stat">
      <text class="footer-num">{{memberCount}}</text>
      <text class="footer-label">参局人数</text>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建组件 WXSS**

```css
.battle-summary {
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.15);
  background: #0A0F18;
  padding: 28rpx 26rpx 20rpx;
  margin-bottom: 20rpx;
}

/* 标题区 */
.summary-header { margin-bottom: 20rpx; }

.summary-kicker {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 17rpx;
  letter-spacing: 5rpx;
  color: rgba(0, 175, 255, 0.50);
  text-transform: uppercase;
}

.summary-title {
  font-size: 30rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 6rpx;
}

.summary-line {
  height: 1rpx;
  margin-top: 14rpx;
  background: linear-gradient(90deg, rgba(0, 175, 255, 0.25), rgba(0, 175, 255, 0.06), transparent);
}

/* 房间信息条 */
.summary-meta {
  display: flex;
  gap: 32rpx;
  margin-bottom: 16rpx;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.meta-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.35);
}

.meta-value {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.68);
}

.meta-value.mono {
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 2rpx;
}

.summary-divider {
  height: 1rpx;
  background: rgba(255, 255, 255, 0.06);
  margin-bottom: 20rpx;
}

/* 四宫格 */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.summary-cell {
  background: rgba(0, 175, 255, 0.04);
  border: 1rpx solid rgba(0, 175, 255, 0.08);
  border-radius: 14rpx;
  padding: 18rpx 16rpx;
}

.cell-kicker {
  font-size: 17rpx;
  letter-spacing: 3rpx;
  color: rgba(0, 175, 255, 0.45);
  text-transform: uppercase;
  display: block;
  margin-bottom: 8rpx;
}

.cell-name {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.68);
  display: block;
  margin-bottom: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-number {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 40rpx;
  font-weight: 700;
  display: block;
}

.cell-number.positive {
  color: #32D74B;
  text-shadow: 0 0 16rpx rgba(50, 215, 75, 0.30);
}

.cell-number.negative {
  color: #FF453A;
  text-shadow: 0 0 16rpx rgba(255, 69, 58, 0.25);
}

.cell-number.accent {
  color: #00AFFF;
  text-shadow: 0 0 16rpx rgba(0, 175, 255, 0.30);
}

/* 底部统计条 */
.summary-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.04);
}

.footer-stat {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.footer-num {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.80);
}

.footer-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.35);
}

.footer-dot {
  width: 4rpx;
  height: 4rpx;
  border-radius: 50%;
  background: rgba(0, 175, 255, 0.30);
}

.reduce-motion .cell-number { text-shadow: none; }
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/components/battle-summary/
git commit -m "feat(ui): 新增 battle-summary 战局总结四宫格组件"
```

---

## Task 3: 新建 battle-insight 组件（战局洞察面板）

**Files:**
- Create: `miniprogram/components/battle-insight/battle-insight.js`
- Create: `miniprogram/components/battle-insight/battle-insight.wxml`
- Create: `miniprogram/components/battle-insight/battle-insight.wxss`
- Create: `miniprogram/components/battle-insight/battle-insight.json`

- [ ] **Step 1: 创建组件 JSON**

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建组件 JS**

```javascript
Component({
  properties: {
    mostActiveUser: { type: Object, value: null },  // { nickname, count }
    mostFocusedUser: { type: Object, value: null },  // { nickname, count } — 被记分最多的人
    networkDensity: { type: String, value: 'LOW' },  // HIGH/MEDIUM/LOW
    transferCount: { type: Number, value: 0 },
    memberCount: { type: Number, value: 0 }
  },

  computed: {},

  methods: {
    // 将 density 映射为中文 + 百分比
    getDensityLabel(density) {
      const map = { HIGH: '高', MEDIUM: '中', LOW: '低' };
      return map[density] || '低';
    },
    getDensityPercent(density) {
      const map = { HIGH: 85, MEDIUM: 55, LOW: 25 };
      return map[density] || 25;
    }
  }
})
```

- [ ] **Step 3: 创建组件 WXML**

```xml
<view class="battle-insight">
  <view class="insight-header">
    <view class="insight-kicker">BATTLE INSIGHT</view>
    <view class="insight-title">战局洞察</view>
    <view class="insight-line"></view>
  </view>

  <view class="insight-grid">
    <!-- 最高活跃 -->
    <view class="insight-row">
      <view class="insight-dot dot-blue"></view>
      <text class="insight-label">最高活跃玩家</text>
      <text class="insight-value">{{mostActiveUser.nickname || '--'}}</text>
    </view>

    <!-- 最受关注 -->
    <view class="insight-row">
      <view class="insight-dot dot-purple"></view>
      <text class="insight-label">最受关注玩家</text>
      <text class="insight-value">{{mostFocusedUser.nickname || '--'}}</text>
    </view>

    <!-- 互动密度 -->
    <view class="insight-row">
      <view class="insight-dot dot-cyan"></view>
      <text class="insight-label">互动密度</text>
      <view class="insight-bar-wrap">
        <view class="insight-bar-fill" style="width: {{networkDensity === 'HIGH' ? 85 : networkDensity === 'MEDIUM' ? 55 : 25}}%"></view>
      </view>
      <text class="insight-density">{{networkDensity === 'HIGH' ? '高' : networkDensity === 'MEDIUM' ? '中' : '低'}}</text>
    </view>

    <!-- 流转强度 -->
    <view class="insight-row">
      <view class="insight-dot dot-green"></view>
      <text class="insight-label">流转强度</text>
      <text class="insight-value mono">{{transferCount}}次 / {{memberCount}}人</text>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建组件 WXSS**

```css
.battle-insight {
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  background: #0A0F18;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
}

.insight-header { margin-bottom: 20rpx; }

.insight-kicker {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 17rpx;
  letter-spacing: 5rpx;
  color: rgba(0, 175, 255, 0.50);
  text-transform: uppercase;
}

.insight-title {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 6rpx;
}

.insight-line {
  height: 1rpx;
  margin-top: 14rpx;
  background: linear-gradient(90deg, rgba(0, 175, 255, 0.20), rgba(0, 175, 255, 0.06), transparent);
}

.insight-grid {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.insight-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.insight-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-blue { background: #00AFFF; box-shadow: 0 0 8rpx rgba(0, 175, 255, 0.50); }
.dot-purple { background: #5E5CE6; box-shadow: 0 0 8rpx rgba(94, 92, 230, 0.50); }
.dot-cyan { background: #00C8FF; box-shadow: 0 0 8rpx rgba(0, 200, 255, 0.50); }
.dot-green { background: #30D158; box-shadow: 0 0 8rpx rgba(48, 209, 88, 0.50); }

.insight-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.50);
  flex-shrink: 0;
  width: 180rpx;
}

.insight-value {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  flex: 1;
  text-align: right;
}

.insight-value.mono {
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 1rpx;
}

.insight-bar-wrap {
  flex: 1;
  height: 6rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3rpx;
  overflow: hidden;
}

.insight-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(0, 200, 255, 0.20), #00C8FF);
  border-radius: 3rpx;
  transition: width 0.8s cubic-bezier(0.23, 1, 0.32, 1);
}

.insight-density {
  font-size: 22rpx;
  color: #00C8FF;
  margin-left: 12rpx;
  flex-shrink: 0;
}

.reduce-motion .insight-bar-fill { transition: none; }
.reduce-motion .dot-blue,
.reduce-motion .dot-purple,
.reduce-motion .dot-cyan,
.reduce-motion .dot-green { box-shadow: none; }
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/components/battle-insight/
git commit -m "feat(ui): 新增 battle-insight 战局洞察面板组件"
```

---

## Task 4: 新建 persona-signal 组件（人格信号采集预览）

**Files:**
- Create: `miniprogram/components/persona-signal/persona-signal.js`
- Create: `miniprogram/components/persona-signal/persona-signal.wxml`
- Create: `miniprogram/components/persona-signal/persona-signal.wxss`
- Create: `miniprogram/components/persona-signal/persona-signal.json`

- [ ] **Step 1: 创建组件**

properties 接收 4 个维度信号（从 settle 数据推算）：社交活跃度、风险偏好、资源控制欲、联盟倾向。每个维度有 level（高/中/低）和 percent（0-100）。底部显示"数据已同步镜像系统"状态。

```json
{
  "component": true,
  "usingComponents": {}
}
```

```javascript
Component({
  properties: {
    socialActivity: { type: String, value: '中' },    // 高/中/低
    riskPreference: { type: String, value: '中' },
    resourceControl: { type: String, value: '中' },
    allianceTendency: { type: String, value: '低' }
  },

  methods: {
    levelToPercent(level) {
      return { '高': 80, '中': 50, '低': 25 }[level] || 50;
    }
  }
})
```

```xml
<view class="persona-signal">
  <view class="signal-header">
    <view class="signal-kicker">PERSONA SIGNAL</view>
    <view class="signal-title">人格信号</view>
    <view class="signal-line"></view>
  </view>

  <view class="signal-grid">
    <view class="signal-row">
      <text class="signal-label">社交活跃度</text>
      <view class="signal-bar-wrap">
        <view class="signal-bar-fill" style="width: {{socialActivity === '高' ? 80 : socialActivity === '中' ? 50 : 25}}%"></view>
      </view>
      <text class="signal-level">{{socialActivity}}</text>
    </view>
    <view class="signal-row">
      <text class="signal-label">风险偏好</text>
      <view class="signal-bar-wrap">
        <view class="signal-bar-fill" style="width: {{riskPreference === '高' ? 80 : riskPreference === '中' ? 50 : 25}}%"></view>
      </view>
      <text class="signal-level">{{riskPreference}}</text>
    </view>
    <view class="signal-row">
      <text class="signal-label">资源控制欲</text>
      <view class="signal-bar-wrap">
        <view class="signal-bar-fill" style="width: {{resourceControl === '高' ? 80 : resourceControl === '中' ? 50 : 25}}%"></view>
      </view>
      <text class="signal-level">{{resourceControl}}</text>
    </view>
    <view class="signal-row">
      <text class="signal-label">联盟倾向</text>
      <view class="signal-bar-wrap">
        <view class="signal-bar-fill" style="width: {{allianceTendency === '高' ? 80 : allianceTendency === '中' ? 50 : 25}}%"></view>
      </view>
      <text class="signal-level">{{allianceTendency}}</text>
    </view>
  </view>

  <view class="signal-sync">
    <view class="sync-dot"></view>
    <text class="sync-text">数据已同步镜像系统</text>
    <text class="sync-badge">SYNCED</text>
  </view>
</view>
```

```css
.persona-signal {
  border-radius: 20rpx;
  border: 1rpx solid rgba(94, 92, 230, 0.15);
  background: #0A0F18;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
}

.signal-header { margin-bottom: 20rpx; }

.signal-kicker {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 17rpx;
  letter-spacing: 5rpx;
  color: rgba(94, 92, 230, 0.55);
  text-transform: uppercase;
}

.signal-title {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 6rpx;
}

.signal-line {
  height: 1rpx;
  margin-top: 14rpx;
  background: linear-gradient(90deg, rgba(94, 92, 230, 0.25), rgba(94, 92, 230, 0.06), transparent);
}

.signal-grid {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-bottom: 20rpx;
}

.signal-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.signal-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.50);
  width: 160rpx;
  flex-shrink: 0;
}

.signal-bar-wrap {
  flex: 1;
  height: 6rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3rpx;
  overflow: hidden;
}

.signal-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(94, 92, 230, 0.20), #5E5CE6);
  border-radius: 3rpx;
  transition: width 0.8s cubic-bezier(0.23, 1, 0.32, 1);
}

.signal-level {
  font-size: 22rpx;
  color: #5E5CE6;
  width: 48rpx;
  text-align: right;
  flex-shrink: 0;
}

.signal-sync {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.04);
}

.sync-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #30D158;
  box-shadow: 0 0 8rpx rgba(48, 209, 88, 0.50);
}

.sync-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.35);
  flex: 1;
}

.sync-badge {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 16rpx;
  letter-spacing: 3rpx;
  color: #30D158;
  padding: 4rpx 12rpx;
  border: 1rpx solid rgba(48, 209, 88, 0.25);
  border-radius: 6rpx;
}

.reduce-motion .signal-bar-fill { transition: none; }
.reduce-motion .sync-dot { box-shadow: none; }
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/components/persona-signal/
git commit -m "feat(ui): 新增 persona-signal 人格信号采集预览组件"
```

---

## Task 5: 新建 score-network 组件（积分关系网络）

**Files:**
- Create: `miniprogram/components/score-network/score-network.js`
- Create: `miniprogram/components/score-network/score-network.wxml`
- Create: `miniprogram/components/score-network/score-network.wxss`
- Create: `miniprogram/components/score-network/score-network.json`

这个组件封装 `force-graph` 并增加节点点击交互（弹出详情浮层）。

- [ ] **Step 1: 创建组件**

```json
{
  "component": true,
  "usingComponents": {
    "force-graph": "/components/force-graph/force-graph"
  }
}
```

```javascript
Component({
  properties: {
    nodes: { type: Array, value: [] },
    links: { type: Array, value: [] },
    myUserId: { type: [Number, String], value: '' }
  },

  data: {
    graphWidth: 320,
    graphHeight: 320,
    selectedNode: null,
    nodeDetails: null
  },

  lifetimes: {
    ready() {
      const sysInfo = wx.getWindowInfo();
      const graphWidth = Math.min(sysInfo.windowWidth - 80, 360);
      this.setData({ graphWidth, graphHeight: graphWidth });
    }
  },

  methods: {
    onNodeTap(e) {
      const { nodes, links, myUserId } = this.data;
      const touch = e.touches[0];
      if (!touch) return;

      // 简单命中检测：找最近的节点
      const x = touch.x;
      const y = touch.y;
      let closest = null;
      let minDist = Infinity;

      // 需要从 force-graph 获取节点位置
      // 通过 force-graph 组件的 positions 数据
      const fg = this.selectComponent('#scoreNetworkGraph');
      if (!fg || !fg.data.positions) return;

      fg.data.positions.forEach((pos, i) => {
        const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
        if (dist < minDist && dist < 40) {
          minDist = dist;
          closest = i;
        }
      });

      if (closest === null) {
        this.setData({ selectedNode: null, nodeDetails: null });
        return;
      }

      const node = nodes[closest];
      // 计算该节点的详情
      const outgoing = links.filter(l => l.from === node.userId);
      const incoming = links.filter(l => l.to === node.userId);
      const totalSent = outgoing.reduce((s, l) => s + l.netAmount, 0);
      const totalReceived = incoming.reduce((s, l) => s + l.netAmount, 0);
      const topRecipient = outgoing.sort((a, b) => b.netAmount - a.netAmount)[0];
      const topSender = incoming.sort((a, b) => b.netAmount - a.netAmount)[0];

      const details = {
        nickname: node.nickname,
        score: node.score,
        isMe: String(node.userId) === String(myUserId),
        totalSent,
        totalReceived,
        netGain: totalReceived - totalSent,
        interactionCount: outgoing.length + incoming.length,
        topRecipientName: topRecipient ? (nodes.find(n => n.userId === topRecipient.to) || {}).nickname || '--' : '--',
        topSenderName: topSender ? (nodes.find(n => n.userId === topSender.from) || {}).nickname || '--' : '--'
      };

      this.setData({ selectedNode: closest, nodeDetails: details });
    },

    closeDetail() {
      this.setData({ selectedNode: null, nodeDetails: null });
    }
  }
})
```

```xml
<view class="score-network">
  <view class="network-header">
    <view class="network-kicker">SCORE NETWORK</view>
    <view class="network-title">积分关系网络</view>
    <view class="network-line"></view>
  </view>

  <view class="network-graph-wrap" bindtap="onNodeTap">
    <force-graph
      id="scoreNetworkGraph"
      nodes="{{nodes}}"
      links="{{links}}"
      width="{{graphWidth}}"
      height="{{graphHeight}}" />
  </view>

  <!-- 节点详情浮层 -->
  <view class="node-detail {{selectedNode !== null ? 'node-detail--show' : ''}}" wx:if="{{nodeDetails}}">
    <view class="detail-header">
      <text class="detail-name" style="color: {{nodeDetails.isMe ? '#00AFFF' : 'rgba(255,255,255,0.92)'}}">{{nodeDetails.nickname}}</text>
      <text class="detail-score" style="color: {{nodeDetails.score >= 0 ? '#32D74B' : '#FF453A'}}">
        {{nodeDetails.score > 0 ? '+' : ''}}{{nodeDetails.score}}
      </text>
      <view class="detail-close" bindtap="closeDetail">✕</view>
    </view>
    <view class="detail-grid">
      <view class="detail-cell">
        <text class="detail-cell-label">向谁输送最多</text>
        <text class="detail-cell-value">{{nodeDetails.topRecipientName}}</text>
      </view>
      <view class="detail-cell">
        <text class="detail-cell-label">从谁获得最多</text>
        <text class="detail-cell-value">{{nodeDetails.topSenderName}}</text>
      </view>
      <view class="detail-cell">
        <text class="detail-cell-label">互动次数</text>
        <text class="detail-cell-value mono">{{nodeDetails.interactionCount}}</text>
      </view>
      <view class="detail-cell">
        <text class="detail-cell-label">净收益</text>
        <text class="detail-cell-value mono" style="color: {{nodeDetails.netGain >= 0 ? '#32D74B' : '#FF453A'}}">
          {{nodeDetails.netGain > 0 ? '+' : ''}}{{nodeDetails.netGain}}
        </text>
      </view>
    </view>
  </view>
</view>
```

```css
.score-network {
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  background: #0A0F18;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
}

.network-header { margin-bottom: 16rpx; }

.network-kicker {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 17rpx;
  letter-spacing: 5rpx;
  color: rgba(0, 175, 255, 0.50);
  text-transform: uppercase;
}

.network-title {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 6rpx;
}

.network-line {
  height: 1rpx;
  margin-top: 14rpx;
  background: linear-gradient(90deg, rgba(0, 175, 255, 0.20), rgba(0, 175, 255, 0.06), transparent);
}

.network-graph-wrap {
  display: flex;
  justify-content: center;
  padding: 8rpx 0;
}

/* 节点详情浮层 */
.node-detail {
  margin-top: 16rpx;
  background: rgba(0, 175, 255, 0.04);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  border-radius: 14rpx;
  padding: 18rpx 20rpx;
  opacity: 0;
  transform: translateY(8rpx);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}

.node-detail--show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.detail-name {
  font-size: 26rpx;
  font-weight: 600;
  flex: 1;
}

.detail-score {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 30rpx;
  font-weight: 700;
}

.detail-close {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.35);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
}

.detail-cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.detail-cell-label {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 1rpx;
}

.detail-cell-value {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.80);
}

.detail-cell-value.mono {
  font-family: 'SF Mono', 'Courier New', monospace;
}

.reduce-motion .node-detail { transition: none; }
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/components/score-network/
git commit -m "feat(ui): 新增 score-network 积分关系网络组件（封装 force-graph + 节点详情）"
```

---

## Task 6: score-chart 组件增加 eventMarkers 支持

**Files:**
- Modify: `miniprogram/components/score-chart/score-chart.js`
- Modify: `miniprogram/components/score-chart/score-chart.wxml`
- Modify: `miniprogram/components/score-chart/score-chart.wxss`

- [ ] **Step 1: 在 score-chart.js 的 properties 中增加 eventMarkers**

```javascript
// 在 properties 中添加：
eventMarkers: { type: Array, value: [] }
// 格式: [{ index: 2, label: '+88', color: '#00AFFF' }, ...]
```

- [ ] **Step 2: 在 _draw 方法中，曲线绘制之后、游标绘制之前，添加 eventMarkers 绘制逻辑**

```javascript
// 在 _draw 方法中，ctx.restore() 之后添加：
if (progress >= 1 && this.data.eventMarkers && this.data.eventMarkers.length > 0) {
  this._drawEventMarkers(ctx, points, pad, h);
}
```

- [ ] **Step 3: 实现 _drawEventMarkers 方法**

```javascript
_drawEventMarkers(ctx, points, pad, h) {
  const markers = this.data.eventMarkers;
  for (const marker of markers) {
    if (marker.index < 0 || marker.index >= points.length) continue;
    const p = points[marker.index];
    const color = marker.color || '#00AFFF';

    // 竖虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(p.x, pad.top);
    ctx.lineTo(p.x, h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 标签
    ctx.save();
    ctx.font = '10px "SF Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.shadowColor = color.replace(')', ',0.4)').replace('rgb', 'rgba');
    ctx.shadowBlur = 6;
    ctx.fillText(marker.label, p.x, pad.top - 6);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/components/score-chart/
git commit -m "feat(chart): score-chart 支持 eventMarkers 属性，标记关键积分事件"
```

---

## Task 7: 重写 settle 页面 — JS 数据层

**Files:**
- Modify: `miniprogram/pages/settle/settle.js`
- Modify: `miniprogram/pages/settle/settle.json`

- [ ] **Step 1: 更新 settle.json 注册新组件**

```json
{
  "navigationBarTitleText": "战局报告",
  "usingComponents": {
    "battle-summary": "/components/battle-summary/battle-summary",
    "score-chart": "/components/score-chart/score-chart",
    "score-network": "/components/score-network/score-network",
    "battle-insight": "/components/battle-insight/battle-insight",
    "persona-signal": "/components/persona-signal/persona-signal"
  }
}
```

- [ ] **Step 2: 重写 settle.js**

```javascript
const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    roomId: '',
    roomNo: '',
    loading: true,
    settleTime: '',
    // 战局总结
    winner: null,
    loser: null,
    maxSingle: 0,
    totalTransfer: 0,
    transferCount: 0,
    memberCount: 0,
    // 图表
    timestamps: [],
    series: [],
    visibleUsers: [],
    eventMarkers: [],
    // 排名
    rankedMembers: [],
    myUserId: '',
    // 关系网络
    networkNodes: [],
    networkLinks: [],
    // 战局洞察
    insight: null,
    // 人格信号
    personaSignals: null
  },

  onLoad(options) {
    const roomId = options.roomId || '';
    this.setData({
      roomId,
      myUserId: app.globalData.userId || ''
    });
    if (roomId) {
      this.loadData(roomId);
    }
  },

  async loadData(roomId) {
    this.setData({ loading: true });
    try {
      const [chartData, roomData, insightData, networkData] = await Promise.all([
        get(`/score/room/${roomId}/chart`),
        get(`/room/${roomId}`),
        get(`/score/room/${roomId}/insight`),
        get(`/score/room/${roomId}/network`)
      ]);

      // === 图表数据 ===
      const timestamps = chartData.timestamps || [];
      const series = chartData.series || [];
      const visibleUsers = series.map(s => String(s.userId));

      // === 成员合并 ===
      const memberMap = {};
      (roomData.members || []).forEach(m => {
        memberMap[String(m.userId)] = m;
      });

      const memberScores = series.map(s => {
        const scores = s.scores || [];
        const finalScore = scores.length > 0 ? scores[scores.length - 1] : 0;
        const member = memberMap[String(s.userId)] || {};
        const nickname = s.nickname || member.nickname || '?';
        return {
          userId: s.userId,
          nickname,
          avatarChar: getFirstChar(nickname),
          avatarUrl: member.avatarUrl || '',
          finalScore,
          avatarColor: getColor(nickname)
        };
      });
      const rankedMembers = [...memberScores].sort((a, b) => b.finalScore - a.finalScore);

      // === 战局总结 ===
      const winner = rankedMembers.length > 0 ? rankedMembers[0] : null;
      const loser = rankedMembers.length > 0 ? rankedMembers[rankedMembers.length - 1] : null;
      // 从 series 计算最大单笔变化
      let maxSingle = 0;
      for (const s of series) {
        const scores = s.scores || [];
        for (let i = 1; i < scores.length; i++) {
          const delta = Math.abs(scores[i] - scores[i - 1]);
          if (delta > maxSingle) maxSingle = delta;
        }
      }
      // 如果 insight 有更大的值则采用
      if (insightData && insightData.maxSingleTransfer > maxSingle) {
        maxSingle = insightData.maxSingleTransfer;
      }

      // === 事件标记（最大单笔事件）===
      const eventMarkers = [];
      for (const s of series) {
        const scores = s.scores || [];
        for (let i = 1; i < scores.length; i++) {
          const delta = scores[i] - scores[i - 1];
          if (Math.abs(delta) === maxSingle && maxSingle > 0) {
            eventMarkers.push({
              index: i,
              label: (delta > 0 ? '+' : '') + delta,
              color: delta > 0 ? '#32D74B' : '#FF453A'
            });
            break;
          }
        }
        if (eventMarkers.length > 0) break;
      }

      // === 人格信号推算 ===
      const personaSignals = this._calcPersonaSignals(rankedMembers, insightData, networkData);

      // === 网络数据 ===
      const networkNodes = (networkData.nodes || []).map(n => ({
        ...n,
        avatarColor: getColor(n.nickname)
      }));
      const networkLinks = networkData.links || [];

      // === 结束时间 ===
      const now = new Date();
      const settleTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      this.setData({
        timestamps,
        series,
        visibleUsers,
        eventMarkers,
        rankedMembers,
        roomNo: roomData.roomNo || '',
        settleTime,
        winner,
        loser,
        maxSingle,
        totalTransfer: insightData ? insightData.totalTransfer : 0,
        transferCount: insightData ? insightData.transferCount : 0,
        memberCount: rankedMembers.length,
        networkNodes,
        networkLinks,
        insight: insightData || null,
        personaSignals,
        loading: false
      });
    } catch (e) {
      console.error('加载战局报告失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 从结算数据推算人格信号（纯前端计算，无需后端）
   */
  _calcPersonaSignals(rankedMembers, insight, network) {
    if (!rankedMembers || rankedMembers.length === 0) {
      return { socialActivity: '中', riskPreference: '中', resourceControl: '中', allianceTendency: '低' };
    }

    const n = rankedMembers.length;
    const myData = rankedMembers.find(m => String(m.userId) === String(this.data.myUserId));

    // 社交活跃度：基于 insight.mostActiveUser 和流转次数
    let socialActivity = '中';
    if (insight && insight.transferCount) {
      const avgTransfers = insight.transferCount / Math.max(n, 1);
      if (avgTransfers > 3) socialActivity = '高';
      else if (avgTransfers < 1.5) socialActivity = '低';
    }

    // 风险偏好：基于最大单笔与平均分的比值
    let riskPreference = '中';
    if (myData) {
      const absScore = Math.abs(myData.finalScore);
      const avgScore = rankedMembers.reduce((s, m) => s + Math.abs(m.finalScore), 0) / n;
      if (absScore > avgScore * 1.5) riskPreference = '高';
      else if (absScore < avgScore * 0.5) riskPreference = '低';
    }

    // 资源控制欲：基于排名
    let resourceControl = '中';
    if (myData) {
      const rank = rankedMembers.indexOf(myData);
      if (rank === 0) resourceControl = '高';
      else if (rank >= n - 1) resourceControl = '低';
    }

    // 联盟倾向：基于网络中互动对数
    let allianceTendency = '低';
    if (network && network.links && n > 2) {
      const uniquePairs = new Set(network.links.map(l => [l.from, l.to].sort().join(':')));
      const maxPairs = (n * (n - 1)) / 2;
      const ratio = uniquePairs.size / maxPairs;
      if (ratio > 0.5) allianceTendency = '高';
      else if (ratio > 0.2) allianceTendency = '中';
    }

    return { socialActivity, riskPreference, resourceControl, allianceTendency };
  },

  handleClose() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/room/room' });
    }
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/settle/settle.js miniprogram/pages/settle/settle.json
git commit -m "feat(settle): 重写结算页 JS 数据层，集成 insight/network/persona 数据"
```

---

## Task 8: 重写 settle 页面 — WXML 布局

**Files:**
- Modify: `miniprogram/pages/settle/settle.wxml`

- [ ] **Step 1: 全面重写 WXML 为战局报告终端布局**

```xml
<scroll-view class="page-container" scroll-y enhanced show-scrollbar="{{false}}"
  class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}">

  <!-- 加载态 -->
  <view class="loading-wrap" wx:if="{{loading}}">
    <view class="loading-dots">
      <view class="loading-dot dot-1"></view>
      <view class="loading-dot dot-2"></view>
      <view class="loading-dot dot-3"></view>
    </view>
    <text class="loading-label">GENERATING REPORT</text>
    <text class="loading-hint">正在解析战局数据</text>
  </view>

  <block wx:else>
    <!-- 顶部关闭按钮（赛博终端风格） -->
    <view class="top-bar">
      <view class="close-btn-cyber" bindtap="handleClose">
        <view class="close-ring">
          <view class="close-x">✕</view>
        </view>
      </view>
    </view>

    <!-- 1. 战局总结 -->
    <battle-summary
      winner="{{winner}}"
      loser="{{loser}}"
      maxSingle="{{maxSingle}}"
      totalTransfer="{{totalTransfer}}"
      transferCount="{{transferCount}}"
      memberCount="{{memberCount}}"
      roomNo="{{roomNo}}"
      settleTime="{{settleTime}}" />

    <!-- 2. 积分趋势图 -->
    <view class="section-card" wx:if="{{series.length > 0}}">
      <view class="card-header">
        <view class="card-kicker">FLOW TIMELINE</view>
        <view class="card-title">积分演化轨迹</view>
        <view class="card-line"></view>
      </view>
      <view class="chart-wrap">
        <score-chart
          timestamps="{{timestamps}}"
          series="{{series}}"
          visibleUsers="{{visibleUsers}}"
          eventMarkers="{{eventMarkers}}"
          highlightUser="{{myUserId}}" />
      </view>
    </view>

    <!-- 3. 积分关系网络 -->
    <score-network
      wx:if="{{networkNodes.length > 0}}"
      nodes="{{networkNodes}}"
      links="{{networkLinks}}"
      myUserId="{{myUserId}}" />

    <!-- 4. 战局洞察 -->
    <battle-insight
      wx:if="{{insight}}"
      mostActiveUser="{{insight.mostActiveUser}}"
      mostFocusedUser="{{loser}}"
      networkDensity="{{insight.networkDensity}}"
      transferCount="{{insight.transferCount}}"
      memberCount="{{memberCount}}" />

    <!-- 5. 最终排名 -->
    <view class="section-card" wx:if="{{rankedMembers.length > 0}}">
      <view class="card-header">
        <view class="card-kicker">FINAL STANDING</view>
        <view class="card-title">最终排名</view>
        <view class="card-line"></view>
      </view>
      <view class="rank-list">
        <view class="rank-item {{index === 0 ? 'rank-champion' : ''}}"
          wx:for="{{rankedMembers}}" wx:key="userId">

          <!-- 排名徽章 -->
          <view class="rank-badge {{index < 3 ? 'rank-top3' : ''}} {{index === 0 ? 'badge-champion' : ''}}">
            <text class="rank-num">{{index + 1}}</text>
          </view>

          <!-- 头像 -->
          <view class="rank-avatar" style="background: {{item.avatarColor}}">
            <image wx:if="{{item.avatarUrl}}" src="{{item.avatarUrl}}" class="rank-avatar-img" mode="aspectFill" />
            <text wx:else class="rank-avatar-char">{{item.avatarChar}}</text>
          </view>

          <!-- 昵称 -->
          <text class="rank-name" style="color: {{item.userId == myUserId ? '#00AFFF' : 'rgba(255,255,255,0.85)'}}">
            {{item.nickname}}
            <text wx:if="{{item.userId == myUserId}}" class="me-tag">我</text>
          </text>

          <!-- 分数 -->
          <text class="rank-score"
            style="color: {{item.finalScore > 0 ? '#32D74B' : item.finalScore < 0 ? '#FF453A' : 'rgba(255,255,255,0.35)'}}">
            {{item.finalScore > 0 ? '+' : ''}}{{item.finalScore}}
          </text>
        </view>
      </view>
    </view>

    <!-- 6. 人格信号 -->
    <persona-signal
      wx:if="{{personaSignals}}"
      socialActivity="{{personaSignals.socialActivity}}"
      riskPreference="{{personaSignals.riskPreference}}"
      resourceControl="{{personaSignals.resourceControl}}"
      allianceTendency="{{personaSignals.allianceTendency}}" />

    <!-- 底部留白 -->
    <view style="height: 60rpx;"></view>
  </block>
</scroll-view>
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/settle/settle.wxml
git commit -m "feat(settle): 重写结算页 WXML 为战局报告终端布局"
```

---

## Task 9: 重写 settle 页面 — WXSS 样式

**Files:**
- Modify: `miniprogram/pages/settle/settle.wxss`

- [ ] **Step 1: 全面重写样式**

```css
.page-container {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 0%, rgba(0, 175, 255, 0.06), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94, 92, 230, 0.04), transparent 30%),
    #05070A;
  padding: 0 28rpx 60rpx;
  box-sizing: border-box;
}

/* ===== 顶部关闭按钮 ===== */

.top-bar {
  display: flex;
  justify-content: flex-end;
  padding: 20rpx 0 8rpx;
}

.close-btn-cyber {
  padding: 8rpx;
}

.close-ring {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(0, 175, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { border-color: rgba(0, 175, 255, 0.25); box-shadow: 0 0 0 rgba(0, 175, 255, 0); }
  50% { border-color: rgba(0, 175, 255, 0.50); box-shadow: 0 0 16rpx rgba(0, 175, 255, 0.15); }
}

.close-x {
  font-size: 26rpx;
  color: rgba(0, 175, 255, 0.72);
  font-weight: 300;
}

.close-btn-cyber:active .close-ring {
  background: rgba(0, 175, 255, 0.08);
}

/* ===== 加载态 ===== */

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 300rpx;
}

.loading-dots {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.loading-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(0, 175, 255, 0.50);
  animation: dotPulse 1.2s ease-in-out infinite;
}

.dot-2 { animation-delay: 0.2s; }
.dot-3 { animation-delay: 0.4s; }

@keyframes dotPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.loading-label {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: rgba(0, 175, 255, 0.55);
}

.loading-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 10rpx;
}

/* ===== 卡片通用 ===== */

.section-card {
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  background: #0A0F18;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
}

.card-header {
  margin-bottom: 16rpx;
}

.card-kicker {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 17rpx;
  letter-spacing: 5rpx;
  color: rgba(0, 175, 255, 0.50);
  text-transform: uppercase;
}

.card-title {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 6rpx;
}

.card-line {
  height: 1rpx;
  margin-top: 14rpx;
  background: linear-gradient(90deg, rgba(0, 175, 255, 0.20), rgba(0, 175, 255, 0.06), transparent);
}

.chart-wrap {
  padding: 8rpx 4rpx;
}

/* ===== 排名列表 ===== */

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.04);
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-champion {
  background: rgba(0, 175, 255, 0.03);
  border-radius: 12rpx;
  padding: 20rpx 12rpx;
  border-bottom: none;
  margin-bottom: 4rpx;
}

.rank-badge {
  width: 44rpx;
  height: 44rpx;
  border-radius: 10rpx;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.rank-top3 {
  background: rgba(0, 175, 255, 0.12);
}

.badge-champion {
  background: rgba(0, 175, 255, 0.20);
  border: 1rpx solid rgba(0, 175, 255, 0.35);
  box-shadow: 0 0 16rpx rgba(0, 175, 255, 0.15);
}

.rank-num {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.40);
}

.rank-top3 .rank-num {
  color: #00AFFF;
}

.rank-avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.rank-avatar-img {
  width: 100%;
  height: 100%;
}

.rank-avatar-char {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.rank-name {
  flex: 1;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-tag {
  font-size: 18rpx;
  color: #00AFFF;
  margin-left: 8rpx;
  padding: 2rpx 8rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.25);
  border-radius: 6rpx;
  vertical-align: middle;
}

.rank-score {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 30rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.reduce-motion .close-ring { animation: none; }
.reduce-motion .loading-dot { animation: none; opacity: 0.6; }
.reduce-motion .badge-champion { box-shadow: none; }
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/settle/settle.wxss
git commit -m "feat(settle): 重写结算页样式为赛博终端风格"
```

---

## Task 10: 重写 room.js 结算弹层数据层

**Files:**
- Modify: `miniprogram/pages/room/room.js`
- Modify: `miniprogram/pages/room/room.json`

- [ ] **Step 1: 更新 room.json 注册新组件**

在 `usingComponents` 中添加：

```json
"battle-summary": "/components/battle-summary/battle-summary",
"score-network": "/components/score-network/score-network",
"battle-insight": "/components/battle-insight/battle-insight",
"persona-signal": "/components/persona-signal/persona-signal"
```

- [ ] **Step 2: 扩展 room.js data 中的 settle 相关字段**

在 `data` 对象中新增：

```javascript
settleWinner: null,
settleLoser: null,
settleMaxSingle: 0,
settleTotalTransfer: 0,
settleTransferCount: 0,
settleMemberCount: 0,
settleTime: '',
settleNetworkNodes: [],
settleNetworkLinks: [],
settleInsight: null,
settlePersonaSignals: null,
settleEventMarkers: []
```

- [ ] **Step 3: 重写 showSettleFromResp 方法，增加 insight/network 并行加载**

```javascript
async showSettleFromResp(resp) {
  this._showingSettle = true;
  const timestamps = resp.timestamps || [];
  const series = resp.series || [];
  const visibleUsers = series.map(s => String(s.userId));
  const rankedMembers = (resp.memberScores || []).map(m => ({
    userId: m.userId,
    nickname: m.nickname || '?',
    avatarChar: getFirstChar(m.nickname),
    avatarUrl: m.avatarUrl || '',
    finalScore: m.finalScore || 0,
    avatarColor: getColor(m.nickname)
  }));

  // 先展示基础数据
  const winner = rankedMembers.length > 0 ? rankedMembers[0] : null;
  const loser = rankedMembers.length > 0 ? rankedMembers[rankedMembers.length - 1] : null;
  let maxSingle = 0;
  for (const s of series) {
    const scores = s.scores || [];
    for (let i = 1; i < scores.length; i++) {
      const delta = Math.abs(scores[i] - scores[i - 1]);
      if (delta > maxSingle) maxSingle = delta;
    }
  }

  const now = new Date();
  const settleTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const eventMarkers = [];
  for (const s of series) {
    const scores = s.scores || [];
    for (let i = 1; i < scores.length; i++) {
      const delta = scores[i] - scores[i - 1];
      if (Math.abs(delta) === maxSingle && maxSingle > 0) {
        eventMarkers.push({ index: i, label: (delta > 0 ? '+' : '') + delta, color: delta > 0 ? '#32D74B' : '#FF453A' });
        break;
      }
    }
    if (eventMarkers.length > 0) break;
  }

  this.setData({
    showSettleOverlay: true,
    settleTimestamps: timestamps,
    settleSeries: series,
    settleVisibleUsers: visibleUsers,
    settleRankedMembers: rankedMembers,
    settleRoomNo: resp.roomNo || '',
    settleWinner: winner,
    settleLoser: loser,
    settleMaxSingle: maxSingle,
    settleMemberCount: rankedMembers.length,
    settleTime,
    settleEventMarkers: eventMarkers
  });

  // 异步加载 insight 和 network（不阻塞主展示）
  const roomId = resp.roomId || this.data.currentRoom?.roomId;
  if (roomId) {
    Promise.all([
      get(`/score/room/${roomId}/insight`).catch(() => null),
      get(`/score/room/${roomId}/network`).catch(() => null)
    ]).then(([insightData, networkData]) => {
      const updates = {};
      if (insightData) {
        updates.settleInsight = insightData;
        updates.settleTotalTransfer = insightData.totalTransfer || 0;
        updates.settleTransferCount = insightData.transferCount || 0;
        if (insightData.maxSingleTransfer > maxSingle) {
          updates.settleMaxSingle = insightData.maxSingleTransfer;
        }
      }
      if (networkData) {
        updates.settleNetworkNodes = (networkData.nodes || []).map(n => ({
          ...n, avatarColor: getColor(n.nickname)
        }));
        updates.settleNetworkLinks = networkData.links || [];
      }
      // 人格信号
      updates.settlePersonaSignals = this._calcSettlePersonaSignals(rankedMembers, insightData, networkData);
      this.setData(updates);
    });
  }
},

_calcSettlePersonaSignals(rankedMembers, insight, network) {
  // 与 settle.js 中 _calcPersonaSignals 相同逻辑
  if (!rankedMembers || rankedMembers.length === 0) {
    return { socialActivity: '中', riskPreference: '中', resourceControl: '中', allianceTendency: '低' };
  }
  const n = rankedMembers.length;
  const myId = String(this.data.myUserId);
  const myData = rankedMembers.find(m => String(m.userId) === myId);

  let socialActivity = '中';
  if (insight && insight.transferCount) {
    const avg = insight.transferCount / Math.max(n, 1);
    if (avg > 3) socialActivity = '高';
    else if (avg < 1.5) socialActivity = '低';
  }

  let riskPreference = '中';
  if (myData) {
    const absScore = Math.abs(myData.finalScore);
    const avgScore = rankedMembers.reduce((s, m) => s + Math.abs(m.finalScore), 0) / n;
    if (absScore > avgScore * 1.5) riskPreference = '高';
    else if (absScore < avgScore * 0.5) riskPreference = '低';
  }

  let resourceControl = '中';
  if (myData) {
    const rank = rankedMembers.indexOf(myData);
    if (rank === 0) resourceControl = '高';
    else if (rank >= n - 1) resourceControl = '低';
  }

  let allianceTendency = '低';
  if (network && network.links && n > 2) {
    const pairs = new Set(network.links.map(l => [l.from, l.to].sort().join(':')));
    const max = (n * (n - 1)) / 2;
    const ratio = pairs.size / max;
    if (ratio > 0.5) allianceTendency = '高';
    else if (ratio > 0.2) allianceTendency = '中';
  }

  return { socialActivity, riskPreference, resourceControl, allianceTendency };
}
```

- [ ] **Step 4: 同步更新 fetchAndShowSettle 方法，增加并行加载**

对 `fetchAndShowSettle` 方法做同样的改造：先展示基础数据，再异步加载 insight/network。

- [ ] **Step 5: 更新 closeSettleOverlay 清理新增字段**

在 `closeSettleOverlay` 的 `setData` 中添加清理：

```javascript
settleWinner: null,
settleLoser: null,
settleMaxSingle: 0,
settleTotalTransfer: 0,
settleTransferCount: 0,
settleMemberCount: 0,
settleTime: '',
settleNetworkNodes: [],
settleNetworkLinks: [],
settleInsight: null,
settlePersonaSignals: null,
settleEventMarkers: []
```

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/room/room.js miniprogram/pages/room/room.json
git commit -m "feat(room): 结算弹层集成战局洞察和积分关系网络"
```

---

## Task 11: 重写 room.wxml 结算弹层布局

**Files:**
- Modify: `miniprogram/pages/room/room.wxml` (lines 695-757)
- Modify: `miniprogram/pages/room/room.wxss`

- [ ] **Step 1: 替换 room.wxml 中的结算弹层**

将 695-757 行的结算弹层替换为新布局（与 settle.wxml 结构一致，但使用 settle 前缀的数据字段）：

```xml
<!-- 战局报告弹层 -->
<view class="settle-overlay {{showSettleOverlay ? 'settle-overlay--show' : ''}}" catchtouchmove="preventClose">
  <scroll-view class="settle-overlay__inner" scroll-y enhanced show-scrollbar="{{false}}">

    <!-- 顶部关闭按钮 -->
    <view class="settle-top-bar">
      <view class="settle-close-cyber" bindtap="closeSettleOverlay">
        <view class="settle-close-ring">
          <view class="settle-close-x">✕</view>
        </view>
      </view>
    </view>

    <!-- 1. 战局总结 -->
    <battle-summary
      winner="{{settleWinner}}"
      loser="{{settleLoser}}"
      maxSingle="{{settleMaxSingle}}"
      totalTransfer="{{settleTotalTransfer}}"
      transferCount="{{settleTransferCount}}"
      memberCount="{{settleMemberCount}}"
      roomNo="{{settleRoomNo}}"
      settleTime="{{settleTime}}" />

    <!-- 2. 积分趋势图 -->
    <view class="settle-card" wx:if="{{settleSeries.length > 0}}">
      <view class="settle-card-header">
        <view class="settle-kicker">FLOW TIMELINE</view>
        <view class="settle-card-title">积分演化轨迹</view>
        <view class="settle-card-line"></view>
      </view>
      <view class="settle-chart-wrap">
        <score-chart
          timestamps="{{settleTimestamps}}"
          series="{{settleSeries}}"
          visibleUsers="{{settleVisibleUsers}}"
          eventMarkers="{{settleEventMarkers}}"
          highlightUser="{{myUserId}}" />
      </view>
    </view>

    <!-- 3. 积分关系网络 -->
    <score-network
      wx:if="{{settleNetworkNodes.length > 0}}"
      nodes="{{settleNetworkNodes}}"
      links="{{settleNetworkLinks}}"
      myUserId="{{myUserId}}" />

    <!-- 4. 战局洞察 -->
    <battle-insight
      wx:if="{{settleInsight}}"
      mostActiveUser="{{settleInsight.mostActiveUser}}"
      mostFocusedUser="{{settleLoser}}"
      networkDensity="{{settleInsight.networkDensity}}"
      transferCount="{{settleInsight.transferCount}}"
      memberCount="{{settleMemberCount}}" />

    <!-- 5. 最终排名 -->
    <view class="settle-card" wx:if="{{settleRankedMembers.length > 0}}">
      <view class="settle-card-header">
        <view class="settle-kicker">FINAL STANDING</view>
        <view class="settle-card-title">最终排名</view>
        <view class="settle-card-line"></view>
      </view>
      <view class="settle-rank-list">
        <view class="settle-rank-item {{index === 0 ? 'settle-rank-champion' : ''}}"
          wx:for="{{settleRankedMembers}}" wx:key="userId">
          <view class="settle-rank-badge {{index < 3 ? 'settle-rank-top3' : ''}} {{index === 0 ? 'settle-badge-champion' : ''}}">
            <text class="settle-rank-num">{{index + 1}}</text>
          </view>
          <view class="settle-rank-avatar" style="background: {{item.avatarColor}}">
            <image wx:if="{{item.avatarUrl}}" src="{{item.avatarUrl}}" class="settle-rank-avatar-img" mode="aspectFill" />
            <text wx:else class="settle-rank-avatar-char">{{item.avatarChar}}</text>
          </view>
          <text class="settle-rank-name" style="color: {{item.userId == myUserId ? '#00AFFF' : 'rgba(255,255,255,0.85)'}}">
            {{item.nickname}}
            <text wx:if="{{item.userId == myUserId}}" class="settle-me-tag">我</text>
          </text>
          <text class="settle-rank-score"
            style="color: {{item.finalScore > 0 ? '#32D74B' : item.finalScore < 0 ? '#FF453A' : 'rgba(255,255,255,0.35)'}}">
            {{item.finalScore > 0 ? '+' : ''}}{{item.finalScore}}
          </text>
        </view>
      </view>
    </view>

    <!-- 6. 人格信号 -->
    <persona-signal
      wx:if="{{settlePersonaSignals}}"
      socialActivity="{{settlePersonaSignals.socialActivity}}"
      riskPreference="{{settlePersonaSignals.riskPreference}}"
      resourceControl="{{settlePersonaSignals.resourceControl}}"
      allianceTendency="{{settlePersonaSignals.allianceTendency}}" />

    <!-- 底部留白 -->
    <view style="height: 60rpx;"></view>
  </scroll-view>
</view>
```

- [ ] **Step 2: 重写 room.wxss 中 settle 相关样式**

替换所有 `settle-` 前缀的样式为赛博终端风格（与 settle.wxss 一致的设计语言）。需要替换的样式块包括：`settle-overlay`、`settle-header`、`settle-section`、`settle-rank-*` 等所有以 `settle-` 开头的类。

新增样式：

```css
/* ===== 战局报告弹层 ===== */

.settle-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  background: #05070A;
  transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.23, 1, 0.32, 1);
}

.settle-overlay--show {
  transform: translateY(0);
}

.settle-overlay__inner {
  height: 100%;
  padding: 0 28rpx 60rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 20% 0%, rgba(0, 175, 255, 0.06), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94, 92, 230, 0.04), transparent 30%),
    transparent;
}

.settle-top-bar {
  display: flex;
  justify-content: flex-end;
  padding: 20rpx 0 8rpx;
}

.settle-close-cyber { padding: 8rpx; }

.settle-close-ring {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(0, 175, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: settleBreathe 3s ease-in-out infinite;
}

@keyframes settleBreathe {
  0%, 100% { border-color: rgba(0, 175, 255, 0.25); box-shadow: 0 0 0 rgba(0, 175, 255, 0); }
  50% { border-color: rgba(0, 175, 255, 0.50); box-shadow: 0 0 16rpx rgba(0, 175, 255, 0.15); }
}

.settle-close-x {
  font-size: 26rpx;
  color: rgba(0, 175, 255, 0.72);
  font-weight: 300;
}

/* 卡片通用 */
.settle-card {
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  background: #0A0F18;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
}

.settle-card-header { margin-bottom: 16rpx; }

.settle-kicker {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 17rpx;
  letter-spacing: 5rpx;
  color: rgba(0, 175, 255, 0.50);
  text-transform: uppercase;
}

.settle-card-title {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 6rpx;
}

.settle-card-line {
  height: 1rpx;
  margin-top: 14rpx;
  background: linear-gradient(90deg, rgba(0, 175, 255, 0.20), rgba(0, 175, 255, 0.06), transparent);
}

.settle-chart-wrap {
  padding: 8rpx 4rpx;
}

/* 排名列表 */
.settle-rank-list {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.settle-rank-item {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.04);
}

.settle-rank-item:last-child { border-bottom: none; }

.settle-rank-champion {
  background: rgba(0, 175, 255, 0.03);
  border-radius: 12rpx;
  padding: 20rpx 12rpx;
  border-bottom: none;
  margin-bottom: 4rpx;
}

.settle-rank-badge {
  width: 44rpx;
  height: 44rpx;
  border-radius: 10rpx;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.settle-rank-top3 { background: rgba(0, 175, 255, 0.12); }

.settle-badge-champion {
  background: rgba(0, 175, 255, 0.20);
  border: 1rpx solid rgba(0, 175, 255, 0.35);
  box-shadow: 0 0 16rpx rgba(0, 175, 255, 0.15);
}

.settle-rank-num {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.40);
}

.settle-rank-top3 .settle-rank-num { color: #00AFFF; }

.settle-rank-avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.settle-rank-avatar-img { width: 100%; height: 100%; }

.settle-rank-avatar-char {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.settle-rank-name {
  flex: 1;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settle-me-tag {
  font-size: 18rpx;
  color: #00AFFF;
  margin-left: 8rpx;
  padding: 2rpx 8rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.25);
  border-radius: 6rpx;
  vertical-align: middle;
}

.settle-rank-score {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 30rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.reduce-motion .settle-overlay { transition: none; }
.reduce-motion .settle-close-ring { animation: none; }
.reduce-motion .settle-badge-champion { box-shadow: none; }
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 结算弹层重写为战局报告终端风格"
```

---

## Task 12: 端到端验证

- [ ] **Step 1: 编译后端**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 2: 微信开发者工具编译检查**

打开微信开发者工具，导入 `miniprogram/` 目录，确认无编译错误。

- [ ] **Step 3: 功能验证清单**

- [ ] 创建房间 → 记分 → 解散房间 → 结算弹层正确展示所有 6 个模块
- [ ] 非房主收到 SETTLE WS → 弹层正确展示
- [ ] 独立结算页（navigateTo settle）正确展示
- [ ] force-graph 节点可点击，详情浮层正确弹出
- [ ] score-chart eventMarkers 正确显示
- [ ] reduce-motion 模式下所有动画禁用
- [ ] 2-3 人小规模房间正常展示
- [ ] 8+ 人大规模房间正常展示（force-graph 不溢出）

- [ ] **Step 4: Final Commit**

```bash
git add -A
git commit -m "feat: 结算页全面重构为战局报告终端"
```
