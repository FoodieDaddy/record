# Score Terminal Phase 2 — 后端 API + Canvas 关系图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增战局洞察 API 和积分关系网络 API，以及前端洞察卡片和 Canvas 力导向图组件

**Architecture:** 后端复用已有 Redis events ZSet 数据源，在 ScoreServiceImpl 中新增两个聚合方法；前端新增 force-graph Canvas 组件 + room 页面集成

**Tech Stack:** Java 21 / Spring Boot 3.2.5 / Redis / WeChat Mini Program Canvas API

---

## 文件结构

### 新建文件
| 文件 | 用途 |
|---|---|
| `backend/src/main/java/com/smartrecord/dto/score/RoomInsightResp.java` | 战局洞察响应 DTO |
| `backend/src/main/java/com/smartrecord/dto/score/RoomNetworkResp.java` | 积分关系网络响应 DTO |
| `miniprogram/components/force-graph/force-graph.js` | 力导向图 Canvas 组件逻辑 |
| `miniprogram/components/force-graph/force-graph.wxml` | 力导向图模板 |
| `miniprogram/components/force-graph/force-graph.wxss` | 力导向图样式 |
| `miniprogram/components/force-graph/force-graph.json` | 组件配置 |

### 修改文件
| 文件 | 操作 |
|---|---|
| `backend/src/main/java/com/smartrecord/service/ScoreService.java` | 新增 2 个方法签名 |
| `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java` | 新增 2 个方法实现 |
| `backend/src/main/java/com/smartrecord/controller/ScoreController.java` | 新增 2 个 GET 接口 |
| `miniprogram/pages/room/room.wxml` | 新增洞察卡片 + 关系图区域 |
| `miniprogram/pages/room/room.wxss` | 新增洞察卡片样式 |
| `miniprogram/pages/room/room.js` | 新增加载洞察/网络数据逻辑 |

---

## 关键上下文

### Redis 数据格式

事件存储在 `sr:room:{rid}:events` ZSet，score 为 timestamp：
```json
// 每个 member 是一个 JSON 字符串
{"from": 123, "to": 456, "amount": 88, "time": 1717680000000}
```

读取方式：`redisTemplate.opsForZSet().range(eventsKey, 0, -1)` 获取全部事件

### 排行榜读取

分数存储在 `sr:room:{rid}:scores` ZSet，score 为积分值：
```java
redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1)
```

### 用户信息查询

```java
User user = userMapper.selectById(userId);
// user.getNickname(), user.getAvatarUrl()
```

### DTO 注解模式

```java
@Data @Builder
@Schema(description = "描述")
public class XxxResp {
    @Schema(description = "字段描述", example = "示例值")
    private Type field;
}
```

### Controller 模式

```java
@Operation(summary = "接口描述")
@GetMapping("/room/{roomId}/xxx")
public Result<XxxResp> getXxx(
        @Parameter(description = "房间 ID") @PathVariable Long roomId) {
    return Result.ok(scoreService.getXxx(roomId));
}
```

---

### Task 1: 后端 DTO — RoomInsightResp + RoomNetworkResp

**Files:**
- Create: `backend/src/main/java/com/smartrecord/dto/score/RoomInsightResp.java`
- Create: `backend/src/main/java/com/smartrecord/dto/score/RoomNetworkResp.java`

- [ ] **Step 1: 创建 RoomInsightResp.java**

```java
package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "战局洞察")
public class RoomInsightResp {

    @Schema(description = "总流转量（所有 amount 之和）", example = "286")
    private Integer totalTransfer;

    @Schema(description = "单次最大流转额", example = "88")
    private Integer maxSingleTransfer;

    @Schema(description = "最活跃用户")
    private ActiveUser mostActiveUser;

    @Schema(description = "流转次数", example = "12")
    private Integer transferCount;

    @Schema(description = "互动密度 HIGH/MEDIUM/LOW", example = "HIGH")
    private String networkDensity;

    @Data
    @Builder
    @Schema(description = "最活跃用户")
    public static class ActiveUser {
        @Schema(description = "用户 ID", example = "123")
        private Long userId;

        @Schema(description = "昵称", example = "先天话痨")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "互动次数", example = "14")
        private Integer count;
    }
}
```

- [ ] **Step 2: 创建 RoomNetworkResp.java**

```java
package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "积分关系网络")
public class RoomNetworkResp {

    @Schema(description = "节点列表")
    private List<Node> nodes;

    @Schema(description = "连线列表")
    private List<Link> links;

    @Data
    @Builder
    @Schema(description = "网络节点")
    public static class Node {
        @Schema(description = "用户 ID", example = "123")
        private Long userId;

        @Schema(description = "昵称", example = "先天话痨")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "当前积分", example = "143")
        private Integer score;
    }

    @Data
    @Builder
    @Schema(description = "网络连线")
    public static class Link {
        @Schema(description = "发起人 ID", example = "123")
        private Long from;

        @Schema(description = "接收人 ID", example = "456")
        private Long to;

        @Schema(description = "净流转额（正数=from→to 净流入）", example = "50")
        private Integer netAmount;

        @Schema(description = "交互次数", example = "5")
        private Integer count;
    }
}
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/smartrecord/dto/score/RoomInsightResp.java \
        backend/src/main/java/com/smartrecord/dto/score/RoomNetworkResp.java
git commit -m "feat: 新增战局洞察和积分关系网络 DTO"
```

---

### Task 2: 后端 Service — getRoomInsight 实现

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/ScoreService.java`（新增方法签名）
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java`（新增实现）

- [ ] **Step 1: 在 ScoreService 接口新增方法**

在 `ScoreService.java` 中，`getTrend` 方法之后新增：

```java
/** 战局洞察 */
RoomInsightResp getRoomInsight(Long roomId);

/** 积分关系网络 */
RoomNetworkResp getRoomNetwork(Long roomId);
```

- [ ] **Step 2: 在 ScoreServiceImpl 实现 getRoomInsight**

在 `ScoreServiceImpl.java` 的 `getTrend` 方法之后（类末尾）新增：

```java
@Override
public RoomInsightResp getRoomInsight(Long roomId) {
    String eventsKey = ROOM_PREFIX + roomId + ":events";
    Set<String> events = redisTemplate.opsForZSet().range(eventsKey, 0, -1);
    if (events == null || events.isEmpty()) {
        return RoomInsightResp.builder()
                .totalTransfer(0)
                .maxSingleTransfer(0)
                .mostActiveUser(null)
                .transferCount(0)
                .networkDensity("LOW")
                .build();
    }

    int totalTransfer = 0;
    int maxSingle = 0;
    Map<Long, Integer> userCount = new HashMap<>();

    for (String json : events) {
        JSONObject obj = JSONUtil.parseObj(json);
        long from = obj.getLong("from", 0L);
        long to = obj.getLong("to", 0L);
        int amount = obj.getInt("amount", 0);

        totalTransfer += amount;
        if (amount > maxSingle) maxSingle = amount;
        userCount.merge(from, 1, Integer::sum);
        userCount.merge(to, 1, Integer::sum);
    }

    // 最活跃用户
    RoomInsightResp.ActiveUser activeUser = null;
    if (!userCount.isEmpty()) {
        Map.Entry<Long, Integer> top = Collections.max(userCount.entrySet(), Map.Entry.comparingByValue());
        User user = userMapper.selectById(top.getKey());
        activeUser = RoomInsightResp.ActiveUser.builder()
                .userId(top.getKey())
                .nickname(user != null ? user.getNickname() : "未知")
                .avatarUrl(user != null ? user.getAvatarUrl() : null)
                .count(top.getValue())
                .build();
    }

    // 互动密度
    String metaKey = ROOM_PREFIX + roomId + ":meta";
    Long memberCount = redisTemplate.opsForHash().size(metaKey);
    int n = memberCount != null ? memberCount.intValue() : 0;
    double density = (n > 1) ? (double) events.size() / (n * (n - 1)) : 0;
    String densityLevel = density > 0.3 ? "HIGH" : density > 0.1 ? "MEDIUM" : "LOW";

    return RoomInsightResp.builder()
            .totalTransfer(totalTransfer)
            .maxSingleTransfer(maxSingle)
            .mostActiveUser(activeUser)
            .transferCount(events.size())
            .networkDensity(densityLevel)
            .build();
}
```

需要确保 import 已存在：
```java
import com.smartrecord.dto.score.RoomInsightResp;
import com.smartrecord.dto.score.RoomNetworkResp;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/smartrecord/service/ScoreService.java \
        backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java
git commit -m "feat: 新增 getRoomInsight 战局洞察聚合方法"
```

---

### Task 3: 后端 Service — getRoomNetwork 实现

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java`

- [ ] **Step 1: 在 ScoreServiceImpl 实现 getRoomNetwork**

在 `getRoomInsight` 方法之后新增：

```java
@Override
public RoomNetworkResp getRoomNetwork(Long roomId) {
    String eventsKey = ROOM_PREFIX + roomId + ":events";
    Set<String> events = redisTemplate.opsForZSet().range(eventsKey, 0, -1);

    // 获取排行榜（当前分数）
    String scoresKey = ROOM_PREFIX + roomId + ":scores";
    Set<ZSetOperations.TypedTuple<String>> scoreSet =
            redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1);

    // 构建 nodes
    List<RoomNetworkResp.Node> nodes = new ArrayList<>();
    if (scoreSet != null) {
        for (ZSetOperations.TypedTuple<String> tuple : scoreSet) {
            Long userId = Long.valueOf(tuple.getValue());
            Double score = tuple.getScore();
            User user = userMapper.selectById(userId);
            nodes.add(RoomNetworkResp.Node.builder()
                    .userId(userId)
                    .nickname(user != null ? user.getNickname() : "未知")
                    .avatarUrl(user != null ? user.getAvatarUrl() : null)
                    .score(score != null ? score.intValue() : 0)
                    .build());
        }
    }

    // 构建 links（按 from→to 分组，计算净流转额和次数）
    Map<String, int[]> pairMap = new HashMap<>(); // "from:to" -> [netAmount, count]
    if (events != null) {
        for (String json : events) {
            JSONObject obj = JSONUtil.parseObj(json);
            long from = obj.getLong("from", 0L);
            long to = obj.getLong("to", 0L);
            int amount = obj.getInt("amount", 0);

            String key = from + ":" + to;
            pairMap.merge(key, new int[]{amount, 1}, (a, b) -> {
                a[0] += b[0];
                a[1] += b[1];
                return a;
            });
        }
    }

    List<RoomNetworkResp.Link> links = new ArrayList<>();
    for (Map.Entry<String, int[]> entry : pairMap.entrySet()) {
        String[] parts = entry.getKey().split(":");
        long from = Long.parseLong(parts[0]);
        long to = Long.parseLong(parts[1]);
        links.add(RoomNetworkResp.Link.builder()
                .from(from)
                .to(to)
                .netAmount(entry.getValue()[0])
                .count(entry.getValue()[1])
                .build());
    }

    return RoomNetworkResp.builder()
            .nodes(nodes)
            .links(links)
            .build();
}
```

需要确保 import：
```java
import com.smartrecord.entity.User;
import org.springframework.data.redis.core.ZSetOperations;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java
git commit -m "feat: 新增 getRoomNetwork 积分关系网络聚合方法"
```

---

### Task 4: 后端 Controller — 两个 GET 接口

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/controller/ScoreController.java`

- [ ] **Step 1: 在 ScoreController 新增两个端点**

在 `getTrend` 方法之后新增：

```java
@Operation(summary = "战局洞察", description = "返回总流转量、最大流转、最活跃用户、互动密度等")
@GetMapping("/room/{roomId}/insight")
public Result<RoomInsightResp> getRoomInsight(
        @Parameter(description = "房间 ID") @PathVariable Long roomId) {
    return Result.ok(scoreService.getRoomInsight(roomId));
}

@Operation(summary = "积分关系网络", description = "返回节点（含当前积分）和连线（含净流转额）")
@GetMapping("/room/{roomId}/network")
public Result<RoomNetworkResp> getRoomNetwork(
        @Parameter(description = "房间 ID") @PathVariable Long roomId) {
    return Result.ok(scoreService.getRoomNetwork(roomId));
}
```

需要确保 import：
```java
import com.smartrecord.dto.score.RoomInsightResp;
import com.smartrecord.dto.score.RoomNetworkResp;
```

- [ ] **Step 2: 验证编译**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/smartrecord/controller/ScoreController.java
git commit -m "feat: 新增 /room/{id}/insight 和 /room/{id}/network 接口"
```

---

### Task 5: 前端 force-graph Canvas 组件

**Files:**
- Create: `miniprogram/components/force-graph/force-graph.js`
- Create: `miniprogram/components/force-graph/force-graph.wxml`
- Create: `miniprogram/components/force-graph/force-graph.wxss`
- Create: `miniprogram/components/force-graph/force-graph.json`

- [ ] **Step 1: 创建 force-graph.json**

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 force-graph.wxml**

```xml
<canvas type="2d" id="forceGraphCanvas" class="force-graph-canvas"
  style="width:{{width}}px;height:{{height}}px;"
  bindtouchstart="onTouchStart">
</canvas>
```

- [ ] **Step 3: 创建 force-graph.wxss**

```css
.force-graph-canvas {
  display: block;
  margin: 0 auto;
}
```

- [ ] **Step 4: 创建 force-graph.js**

```javascript
const app = getApp()

Component({
  properties: {
    nodes: { type: Array, value: [] },
    links: { type: Array, value: [] },
    width: { type: Number, value: 300 },
    height: { type: Number, value: 300 }
  },

  data: {
    ctx: null,
    canvasNode: null,
    positions: [],  // [{x, y, vx, vy}]
    animFrame: 0
  },

  observers: {
    'nodes, links': function (nodes, links) {
      if (nodes && nodes.length > 0) {
        this.initSimulation()
      }
    }
  },

  lifetimes: {
    detached() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId)
      }
    }
  },

  methods: {
    initSimulation() {
      const { nodes, links, width, height } = this.data
      const reduceMotion = !app.globalData.animationEnabled
      const cx = width / 2
      const cy = height / 2

      // 初始化节点位置
      let positions
      if (reduceMotion || nodes.length <= 1) {
        // 静态圆形布局
        positions = nodes.map((n, i) => {
          const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
          const r = Math.min(width, height) * 0.32
          return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            vx: 0,
            vy: 0
          }
        })
        this.setData({ positions })
        this.initCanvas()
        return
      }

      // 力导向布局初始化
      positions = nodes.map(() => ({
        x: cx + (Math.random() - 0.5) * width * 0.5,
        y: cy + (Math.random() - 0.5) * height * 0.5,
        vx: 0,
        vy: 0
      }))
      this.setData({ positions })
      this.initCanvas()
      this.simulate()
    },

    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#forceGraphCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          canvas.width = this.data.width * dpr
          canvas.height = this.data.height * dpr
          ctx.scale(dpr, dpr)
          this.setData({ ctx, canvasNode: canvas })
          this.draw()
        })
    },

    simulate() {
      const { nodes, links, positions, width, height } = this.data
      const n = nodes.length
      const damping = 0.9
      const repulsionK = 2000
      const springK = 0.005
      const restLength = 100
      const iterations = 80

      for (let iter = 0; iter < iterations; iter++) {
        // 排斥力
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            let dx = positions[i].x - positions[j].x
            let dy = positions[i].y - positions[j].y
            let dist = Math.sqrt(dx * dx + dy * dy) || 1
            let force = repulsionK / (dist * dist)
            let fx = (dx / dist) * force
            let fy = (dy / dist) * force
            positions[i].vx += fx
            positions[i].vy += fy
            positions[j].vx -= fx
            positions[j].vy -= fy
          }
        }

        // 弹簧力
        for (const link of links) {
          const fi = nodes.findIndex(n => n.userId === link.from)
          const fj = nodes.findIndex(n => n.userId === link.to)
          if (fi < 0 || fj < 0) continue
          let dx = positions[fj].x - positions[fi].x
          let dy = positions[fj].y - positions[fi].y
          let dist = Math.sqrt(dx * dx + dy * dy) || 1
          let force = springK * (dist - restLength)
          let fx = (dx / dist) * force
          let fy = (dy / dist) * force
          positions[fi].vx += fx
          positions[fi].vy += fy
          positions[fj].vx -= fx
          positions[fj].vy -= fy
        }

        // 更新位置 + 阻尼 + 边界约束
        const padding = 30
        for (let i = 0; i < n; i++) {
          positions[i].vx *= damping
          positions[i].vy *= damping
          positions[i].x += positions[i].vx
          positions[i].y += positions[i].vy
          positions[i].x = Math.max(padding, Math.min(width - padding, positions[i].x))
          positions[i].y = Math.max(padding, Math.min(height - padding, positions[i].y))
        }
      }

      this.setData({ positions })
      this.draw()
    },

    draw() {
      const { ctx, nodes, links, positions, width, height } = this.data
      if (!ctx) return

      ctx.clearRect(0, 0, width, height)

      // 绘制连线
      for (const link of links) {
        const fi = nodes.findIndex(n => n.userId === link.from)
        const fj = nodes.findIndex(n => n.userId === link.to)
        if (fi < 0 || fj < 0) continue

        const p1 = positions[fi]
        const p2 = positions[fj]
        const lineWidth = Math.max(1, Math.min(4, Math.abs(link.count)))

        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.setStrokeStyle(link.netAmount > 0 ? 'rgba(10,132,255,0.5)' : 'rgba(255,90,90,0.5)')
        ctx.setLineWidth(lineWidth)
        ctx.stroke()
      }

      // 绘制节点
      for (let i = 0; i < nodes.length; i++) {
        const p = positions[i]
        const node = nodes[i]
        // 半径按互动量缩放，这里用 score 的绝对值近似
        const radius = Math.max(12, Math.min(28, 12 + Math.abs(node.score || 0) * 0.05))

        // 节点圆
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.setFillStyle('rgba(10,132,255,0.3)')
        ctx.fill()
        ctx.setStrokeStyle('rgba(10,132,255,0.6)')
        ctx.setLineWidth(1)
        ctx.stroke()

        // 昵称标签
        ctx.setFillStyle('rgba(255,255,255,0.7)')
        ctx.setFontSize(10)
        ctx.setTextAlign('center')
        const name = node.nickname || '?'
        ctx.fillText(name.length > 4 ? name.slice(0, 4) + '..' : name, p.x, p.y + radius + 14)
      }
    },

    onTouchStart() {
      // 预留：节点拖拽交互
    }
  }
})
```

- [ ] **Step 5: 验证组件文件完整**

```bash
ls -la miniprogram/components/force-graph/
# 应有 4 个文件: force-graph.js, force-graph.wxml, force-graph.wxss, force-graph.json
```

- [ ] **Step 6: 提交**

```bash
git add miniprogram/components/force-graph/
git commit -m "feat: 新增 force-graph 力导向图 Canvas 组件"
```

---

### Task 6: 前端集成 — 洞察卡片 + 关系图 + 数据加载

**Files:**
- Modify: `miniprogram/pages/room/room.json`（注册组件）
- Modify: `miniprogram/pages/room/room.js`（新增数据加载方法）
- Modify: `miniprogram/pages/room/room.wxml`（新增 UI 区域）
- Modify: `miniprogram/pages/room/room.wxss`（新增样式）

- [ ] **Step 1: 注册组件**

在 `room.json` 的 `usingComponents` 中新增：
```json
"force-graph": "/components/force-graph/force-graph"
```

- [ ] **Step 2: room.js 新增数据字段和加载方法**

在 `data` 中新增：
```javascript
roomInsight: null,
roomNetwork: null,
```

在 `onLoad` 或 `loadRoomData` 成功后调用：
```javascript
this.loadInsightData()
```

新增方法：
```javascript
async loadInsightData() {
  const roomId = this.data.currentRoom?.id
  if (!roomId) return
  try {
    const [insightRes, networkRes] = await Promise.all([
      wx.request({ url: `${app.globalData.baseUrl}/score/room/${roomId}/insight`, header: { 'Authorization': wx.getStorageSync('token') } }),
      wx.request({ url: `${app.globalData.baseUrl}/score/room/${roomId}/network`, header: { 'Authorization': wx.getStorageSync('token') } })
    ])
    if (insightRes.data?.code === 200) {
      this.setData({ roomInsight: insightRes.data.data })
    }
    if (networkRes.data?.code === 200) {
      this.setData({ roomNetwork: networkRes.data.data })
    }
  } catch (e) {
    // 静默失败，不影响主流程
  }
},
```

在收到 WS TRANSFER 消息时，追加刷新：
```javascript
this.loadInsightData()
```

- [ ] **Step 3: room.wxml 新增 UI 区域**

在 FLOW LOG `</view>` 之后、底部操作区 `room-bottom-bar` 之前插入：

```xml
<!-- ROOM INSIGHT 战局洞察 -->
<view class="room-insight" wx:if="{{roomInsight && roomInsight.transferCount > 0}}">
  <view class="ri-header">
    <text class="ri-cn">战局洞察</text>
    <text class="ri-en">ROOM INSIGHT</text>
  </view>
  <view class="ri-divider"></view>
  <view class="ri-row">
    <text class="ri-label">本场最活跃</text>
    <view class="ri-value-group" wx:if="{{roomInsight.mostActiveUser}}">
      <text class="ri-value-name">{{roomInsight.mostActiveUser.nickname}}</text>
      <text class="ri-value-detail">互动{{roomInsight.mostActiveUser.count}}次</text>
    </view>
    <text class="ri-value-na" wx:else>—</text>
  </view>
  <view class="ri-row">
    <text class="ri-label">最大流转</text>
    <text class="ri-value-num">{{roomInsight.maxSingleTransfer}}</text>
  </view>
  <view class="ri-row">
    <text class="ri-label">积分流转量</text>
    <text class="ri-value-num">{{roomInsight.totalTransfer}}</text>
  </view>
  <view class="ri-row">
    <text class="ri-label">互动密度</text>
    <view class="ri-density-wrap">
      <view class="ri-density-bar">
        <view class="ri-density-fill ri-density-{{roomInsight.networkDensity === 'HIGH' ? 'high' : roomInsight.networkDensity === 'MEDIUM' ? 'mid' : 'low'}}"
          style="width:{{roomInsight.networkDensity === 'HIGH' ? '100' : roomInsight.networkDensity === 'MEDIUM' ? '60' : '25'}}%;">
        </view>
      </view>
      <text class="ri-density-text">{{roomInsight.networkDensity}}</text>
    </view>
  </view>
</view>

<!-- NETWORK MAP 积分关系图 -->
<view class="network-map" wx:if="{{roomNetwork && roomNetwork.nodes.length >= 2}}">
  <view class="nm-header">
    <text class="nm-cn">积分关系</text>
    <text class="nm-en">NETWORK MAP</text>
  </view>
  <view class="nm-divider"></view>
  <force-graph
    nodes="{{roomNetwork.nodes}}"
    links="{{roomNetwork.links}}"
    width="{{300}}"
    height="{{300}}">
  </force-graph>
</view>
```

- [ ] **Step 4: room.wxss 新增样式**

在文件末尾追加：

```css
/* ===== ROOM INSIGHT 战局洞察 ===== */
.room-insight {
  padding: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 16rpx;
  background: rgba(255,255,255,0.025);
}
.ri-header {
  display: flex;
  flex-direction: column;
}
.ri-cn {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  letter-spacing: 2rpx;
}
.ri-en {
  font-size: 18rpx;
  color: rgba(255,255,255,0.2);
  letter-spacing: 4rpx;
  font-family: monospace;
  margin-top: 2rpx;
}
.ri-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0;
}
.ri-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
}
.ri-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.56);
}
.ri-value-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.ri-value-name {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}
.ri-value-detail {
  font-size: 22rpx;
  color: rgba(10,132,255,0.72);
}
.ri-value-na {
  font-size: 26rpx;
  color: rgba(255,255,255,0.3);
}
.ri-value-num {
  font-size: 28rpx;
  font-weight: 700;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
  color: #0A84FF;
}
.ri-density-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.ri-density-bar {
  width: 120rpx;
  height: 10rpx;
  background: rgba(255,255,255,0.06);
  border-radius: 5rpx;
  overflow: hidden;
}
.ri-density-fill {
  height: 100%;
  border-radius: 5rpx;
  transition: width 0.4s ease;
}
.ri-density-high {
  background: #0A84FF;
}
.ri-density-mid {
  background: #00C8FF;
}
.ri-density-low {
  background: rgba(255,255,255,0.2);
}
.ri-density-text {
  font-size: 22rpx;
  font-weight: 600;
  font-family: monospace;
  letter-spacing: 2rpx;
  color: rgba(255,255,255,0.56);
}

/* ===== NETWORK MAP 积分关系图 ===== */
.network-map {
  padding: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 16rpx;
  background: rgba(255,255,255,0.025);
}
.nm-header {
  display: flex;
  flex-direction: column;
}
.nm-cn {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  letter-spacing: 2rpx;
}
.nm-en {
  font-size: 18rpx;
  color: rgba(255,255,255,0.2);
  letter-spacing: 4rpx;
  font-family: monospace;
  margin-top: 2rpx;
}
.nm-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0 12rpx;
}
```

- [ ] **Step 5: 验证编译 + 提交**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

```bash
git add miniprogram/pages/room/room.json \
        miniprogram/pages/room/room.js \
        miniprogram/pages/room/room.wxml \
        miniprogram/pages/room/room.wxss
git commit -m "feat(room): 集成战局洞察卡片和积分关系图"
```

---

## 验收标准

- [ ] `GET /score/room/{id}/insight` 返回正确的聚合数据（totalTransfer, maxSingleTransfer, mostActiveUser, transferCount, networkDensity）
- [ ] `GET /score/room/{id}/network` 返回正确的 nodes + links
- [ ] 无 events 时 insight 返回零值，network 返回空列表
- [ ] 战局洞察卡片正确展示最活跃用户/最大流转/流转量/密度条
- [ ] Canvas 力导向图正确渲染节点和连线
- [ ] 4 人以内使用力导向布局，超出时仍可渲染
- [ ] reduce-motion 下使用静态圆形布局
- [ ] 无 `transition: all`，无 `*` 通配符
- [ ] WS TRANSFER 消息到达时洞察数据自动刷新
