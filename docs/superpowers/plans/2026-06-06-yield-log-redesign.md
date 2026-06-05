# 积分流水终端 UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将积分流水页从普通记录列表重构为赛博终端风格，新增后端聚合 API + 前端 yield-chart 组件 + 页面全量重写。

**Architecture:** 后端新增 `GET /score/yield-log` 聚合端点，复用现有 Mapper 查询，一次返回净收益、采样状态、曲线数据、对局记录。前端新建 yield-chart Canvas 组件，全量重写 score-records 页面为终端风格。

**Tech Stack:** Java 21 / Spring Boot 3.2.5 / MyBatis-Plus / 微信小程序原生 / Canvas 2D

---

### Task 1: 新建 YieldLogResp DTO

**Files:**
- Create: `backend/src/main/java/com/smartrecord/dto/score/YieldLogResp.java`

- [ ] **Step 1: 创建 YieldLogResp.java**

```java
package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "积分流水终端响应")
public class YieldLogResp {

    @Schema(description = "近期净收益（所有场次净得分之和）", example = "-143")
    private Integer netYield;

    @Schema(description = "已采样场次数", example = "1")
    private Integer sampleCount;

    @Schema(description = "曲线解锁所需场次数", example = "2")
    private Integer curveUnlockCount;

    @Schema(description = "收益曲线数据点（按时间正序）")
    private List<CurvePoint> curveData;

    @Schema(description = "对局记录列表")
    private List<Record> records;

    @Data
    @Builder
    @Schema(description = "曲线数据点")
    public static class CurvePoint {

        @Schema(description = "房间 ID")
        private Long roomId;

        @Schema(description = "日期 (yyyy-MM-dd)", example = "2026-06-06")
        private String date;

        @Schema(description = "该场净胜分", example = "-143")
        private Integer netScore;
    }

    @Data
    @Builder
    @Schema(description = "对局记录")
    public static class Record {

        @Schema(description = "房间 ID")
        private Long roomId;

        @Schema(description = "房间号", example = "HGEWRT")
        private String roomNo;

        @Schema(description = "结算时间（已格式化）", example = "2026.06.06 02:03")
        private String settledAt;

        @Schema(description = "我的净得分", example = "-143")
        private Integer myScore;

        @Schema(description = "玩家列表")
        private List<Player> players;
    }

    @Data
    @Builder
    @Schema(description = "玩家信息")
    public static class Player {

        @Schema(description = "用户 ID")
        private Long userId;

        @Schema(description = "昵称", example = "摆烂的铁公鸡")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "净得分", example = "-143")
        private Integer score;

        @Schema(description = "是否为当前用户")
        private Boolean isMe;
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/smartrecord/dto/score/YieldLogResp.java
git commit -m "feat(score): 新增 YieldLogResp 积分流水终端 DTO"
```

---

### Task 2: ScoreService 新增 getYieldLog 方法

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/ScoreService.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java`

- [ ] **Step 1: ScoreService 接口新增方法声明**

在 `ScoreService.java` 末尾 `}` 前添加：

```java
/** 积分流水终端数据 */
YieldLogResp getYieldLog(Long userId);
```

- [ ] **Step 2: ScoreServiceImpl 实现 getYieldLog**

在 `ScoreServiceImpl.java` 的 `getTrend` 方法之后（约 line 746），添加：

```java
@Override
public YieldLogResp getYieldLog(Long userId) {
    // 1. 获取趋势数据
    List<Map<String, Object>> trendRows = roomMemberMapper.selectTrendByUserId(userId, 20);

    // 计算净收益
    int netYield = 0;
    List<YieldLogResp.CurvePoint> curvePoints = new ArrayList<>();
    for (int i = trendRows.size() - 1; i >= 0; i--) {
        Map<String, Object> row = trendRows.get(i);
        Integer netScore = ((Number) row.get("netScore")).intValue();
        netYield += netScore;

        Long roomId = ((Number) row.get("roomId")).longValue();
        Object latestAt = row.get("latestAt");
        String date = "";
        if (latestAt instanceof java.sql.Timestamp) {
            date = ((java.sql.Timestamp) latestAt).toLocalDateTime().toLocalDate().toString();
        } else if (latestAt != null) {
            date = latestAt.toString().substring(0, 10);
        }
        curvePoints.add(YieldLogResp.CurvePoint.builder()
                .roomId(roomId)
                .date(date)
                .netScore(netScore)
                .build());
    }

    // 2. 获取历史房间
    List<RoomResp> historyRooms = roomService.getHistory(userId);

    // 构建对局记录
    List<YieldLogResp.Record> records = new ArrayList<>();
    java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");
    for (RoomResp room : historyRooms) {
        String settledAt = room.getCreatedAt() != null ? room.getCreatedAt().format(fmt) : "";

        List<YieldLogResp.Player> players = new ArrayList<>();
        Integer myScore = 0;
        for (RoomResp.MemberVO member : room.getMembers()) {
            boolean isMe = member.getUserId().equals(userId);
            if (isMe) {
                myScore = member.getFinalScore() != null ? member.getFinalScore() : 0;
            }
            players.add(YieldLogResp.Player.builder()
                    .userId(member.getUserId())
                    .nickname(member.getNickname())
                    .avatarUrl(member.getAvatarUrl())
                    .score(member.getFinalScore() != null ? member.getFinalScore() : 0)
                    .isMe(isMe)
                    .build());
        }

        records.add(YieldLogResp.Record.builder()
                .roomId(room.getRoomId())
                .roomNo(room.getRoomNo())
                .settledAt(settledAt)
                .myScore(myScore)
                .players(players)
                .build());
    }

    return YieldLogResp.builder()
            .netYield(netYield)
            .sampleCount(trendRows.size())
            .curveUnlockCount(2)
            .curveData(curvePoints)
            .records(records)
            .build();
}
```

- [ ] **Step 3: 确保 import 存在**

确认 `ScoreServiceImpl.java` 头部有：
```java
import com.smartrecord.dto.room.RoomResp;
```

- [ ] **Step 4: 验证编译**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/smartrecord/service/ScoreService.java backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java
git commit -m "feat(score): 实现 getYieldLog 聚合逻辑"
```

---

### Task 3: ScoreController 新增端点

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/controller/ScoreController.java`

- [ ] **Step 1: 添加 getYieldLog 端点**

在 `ScoreController.java` 的 `getTrend` 方法之后（约 line 99），添加：

```java
@Operation(summary = "积分流水终端", description = "聚合净收益、采样状态、收益曲线、对局记录")
@GetMapping("/yield-log")
public Result<YieldLogResp> getYieldLog(HttpServletRequest request) {
    Long userId = (Long) request.getAttribute("currentUserId");
    return Result.ok(scoreService.getYieldLog(userId));
}
```

- [ ] **Step 2: 验证编译**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/smartrecord/controller/ScoreController.java
git commit -m "feat(score): 新增 GET /score/yield-log 端点"
```

---

### Task 4: 新建 yield-chart 组件

**Files:**
- Create: `miniprogram/components/yield-chart/yield-chart.js`
- Create: `miniprogram/components/yield-chart/yield-chart.wxml`
- Create: `miniprogram/components/yield-chart/yield-chart.wxss`
- Create: `miniprogram/components/yield-chart/yield-chart.json`

- [ ] **Step 1: yield-chart.json**

```json
{
  "component": true
}
```

- [ ] **Step 2: yield-chart.wxml**

```xml
<view class="yield-chart-container">
  <canvas id="yieldCanvas" type="2d" class="yield-canvas" />
</view>
```

- [ ] **Step 3: yield-chart.wxss**

```css
.yield-chart-container {
  width: 100%;
  height: 320rpx;
  background: #0A0F18;
  border-radius: 12rpx;
  overflow: hidden;
}

.yield-canvas {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 4: yield-chart.js**

基于 trend-chart 定制：背景 `#0A0F18`、曲线 `#00AFFF`、正收益区域蓝绿渐变、负收益区域红色渐变、网格线 `rgba(255,255,255,0.05)`、节点发光点。

```javascript
/**
 * 收益曲线组件 — Canvas 2D
 * 累计净收益折线 · 正负渐变填充 · 发光节点 · 终端网格
 */

Component({
  properties: {
    points: { type: Array, value: [] }
  },

  data: {
    canvasHeight: 320
  },

  observers: {
    'points'() {
      this._dataReady = true;
      if (this._initialized) {
        this._draw();
      } else if (this._lifecycleReady) {
        this._scheduleInit();
      }
    }
  },

  lifetimes: {
    ready() {
      this._lifecycleReady = true;
      this._retryCount = 0;
      this._tryInit();
    },
    detached() {
      if (this._drawTimer) clearTimeout(this._drawTimer);
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._ctx = null;
      this._canvas = null;
      this._lifecycleReady = false;
      this._dataReady = false;
      this._initialized = false;
    }
  },

  methods: {
    _tryInit() {
      if (!this._lifecycleReady || !this._dataReady) return;
      this._retryCount = 0;
      this._scheduleInit();
    },

    _scheduleInit() {
      if (this._retryTimer) clearTimeout(this._retryTimer);
      if (this._initialized) return;
      this._retryTimer = setTimeout(() => this._initCanvas(), 200);
    },

    _initCanvas() {
      if (this._initialized) return;
      if (this._retryCount >= 20) return;
      this._retryCount++;

      wx.createSelectorQuery().in(this)
        .select('#yieldCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            this._scheduleInit();
            return;
          }

          const canvas = res[0].node;
          const cssW = res[0].width;
          const cssH = res[0].height;

          if (cssW === 0 || cssH === 0) {
            this._scheduleInit();
            return;
          }

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            this._scheduleInit();
            return;
          }

          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = cssW * dpr;
          canvas.height = cssH * dpr;
          ctx.scale(dpr, dpr);

          this._canvas = canvas;
          this._ctx = ctx;
          this._width = cssW;
          this._height = cssH;
          this._initialized = true;
          this._draw();
        });
    },

    _draw() {
      const ctx = this._ctx;
      if (!ctx) return;
      const { points } = this.data;
      const w = this._width;
      const h = this._height;

      // 背景
      ctx.fillStyle = '#0A0F18';
      ctx.fillRect(0, 0, w, h);

      if (!points || points.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('数据不足', w / 2, h / 2);
        return;
      }

      const pad = { top: 24, right: 20, bottom: 36, left: 44 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;
      const n = points.length;

      // 计算累计积分
      const cumulative = [];
      let sum = 0;
      points.forEach(p => { sum += p.netScore; cumulative.push(sum); });

      let yMin = Math.min(0, ...cumulative);
      let yMax = Math.max(0, ...cumulative);
      const absMax = Math.max(Math.abs(yMin), Math.abs(yMax));
      const finalMax = (absMax === 0 ? 100 : absMax) * 1.15;
      yMin = -finalMax;
      yMax = finalMax;

      const xScale = (i) => pad.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
      const yScale = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
      const zeroY = yScale(0);

      // Y 轴网格
      this._drawYGrid(ctx, pad, w, chartH, yMin, yMax, yScale);

      // X 轴日期标签
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'top';
      const labelCount = Math.min(5, n);
      const step = n > 1 ? (n - 1) / (labelCount - 1) : 0;
      for (let i = 0; i < labelCount; i++) {
        const idx = Math.round(i * step);
        if (idx >= n) continue;
        const x = xScale(idx);
        const label = points[idx].date ? points[idx].date.slice(5) : '';
        ctx.textAlign = i === 0 ? 'left' : i === labelCount - 1 ? 'right' : 'center';
        ctx.fillText(label, x, h - pad.bottom + 10);
      }
      ctx.restore();

      // 计算坐标点
      const xyPoints = cumulative.map((v, i) => ({ x: xScale(i), y: yScale(v) }));

      // 分段渐变填充：正收益蓝绿，负收益红色
      this._fillSegments(ctx, xyPoints, zeroY, h - pad.bottom, pad);

      // 发光折线
      ctx.save();
      ctx.shadowColor = '#00AFFF';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00AFFF';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xyPoints[0].x, xyPoints[0].y);
      for (let i = 1; i < xyPoints.length; i++) ctx.lineTo(xyPoints[i].x, xyPoints[i].y);
      ctx.stroke();
      ctx.restore();

      // 节点发光点
      xyPoints.forEach((pt, i) => {
        ctx.save();
        ctx.shadowColor = '#00AFFF';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#00AFFF';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 终点加强发光
      const last = xyPoints[xyPoints.length - 1];
      ctx.save();
      ctx.shadowColor = '#00AFFF';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#00AFFF';
      ctx.beginPath();
      ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    _fillSegments(ctx, xyPoints, zeroY, bottomY, pad) {
      // 正收益区域（曲线在零线上方）：蓝绿渐变
      // 负收益区域（曲线在零线下方）：红色渐变
      const n = xyPoints.length;
      if (n < 2) return;

      for (let i = 0; i < n - 1; i++) {
        const p0 = xyPoints[i];
        const p1 = xyPoints[i + 1];
        const midY = (p0.y + p1.y) / 2;
        const isPositive = midY <= zeroY;

        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p1.x, zeroY);
        ctx.lineTo(p0.x, zeroY);
        ctx.closePath();

        if (isPositive) {
          const grad = ctx.createLinearGradient(0, pad.top, 0, zeroY);
          grad.addColorStop(0, 'rgba(0, 175, 255, 0.35)');
          grad.addColorStop(1, 'rgba(0, 175, 255, 0.0)');
          ctx.fillStyle = grad;
        } else {
          const grad = ctx.createLinearGradient(0, zeroY, 0, bottomY);
          grad.addColorStop(0, 'rgba(255, 77, 79, 0.0)');
          grad.addColorStop(1, 'rgba(255, 77, 79, 0.35)');
          ctx.fillStyle = grad;
        }
        ctx.fill();
        ctx.restore();
      }
    },

    _drawYGrid(ctx, pad, w, chartH, yMin, yMax, yScale) {
      const tickCount = 4;
      const range = yMax - yMin;
      const rawStep = range / tickCount;
      const step = this._niceStep(rawStep);
      const firstTick = Math.ceil(yMin / step) * step;

      ctx.save();
      for (let v = firstTick; v <= yMax; v += step) {
        const y = yScale(v);
        if (y < pad.top - 2 || y > pad.top + chartH + 2) continue;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._formatAxisValue(v), pad.left - 6, y);
      }

      // 零线强调
      const zeroY = yScale(0);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(w - pad.right, zeroY);
      ctx.stroke();
      ctx.restore();
    },

    _niceStep(rawStep) {
      if (rawStep <= 0) return 1;
      const exp = Math.floor(Math.log10(rawStep));
      const frac = rawStep / Math.pow(10, exp);
      let nice;
      if (frac <= 1.5) nice = 1;
      else if (frac <= 3) nice = 2;
      else if (frac <= 7) nice = 5;
      else nice = 10;
      return nice * Math.pow(10, exp);
    },

    _formatAxisValue(v) {
      if (v === 0) return '0';
      const abs = Math.abs(v);
      const sign = v > 0 ? '+' : '-';
      if (abs >= 100000000) return sign + (Math.round(abs / 10000000) / 10) + '亿';
      if (abs >= 10000) return sign + (Math.round(abs / 1000) / 10) + '万';
      return String(v);
    }
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/components/yield-chart/
git commit -m "feat(chart): 新增 yield-chart 收益曲线组件"
```

---

### Task 5: 重写 score-records 页面

**Files:**
- Modify: `miniprogram/pages/score-records/score-records.js`
- Modify: `miniprogram/pages/score-records/score-records.wxml`
- Modify: `miniprogram/pages/score-records/score-records.wxss`
- Modify: `miniprogram/pages/score-records/score-records.json`

- [ ] **Step 1: score-records.json**

```json
{
  "navigationBarTitleText": "积分记录",
  "usingComponents": {
    "yield-chart": "/components/yield-chart/yield-chart"
  }
}
```

- [ ] **Step 2: score-records.js**

单次请求 `GET /score/yield-log`，替换原来的两个请求。

```javascript
const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');

Page({
  data: {
    loading: true,
    netYield: 0,
    sampleCount: 0,
    curveUnlockCount: 2,
    curveData: [],
    records: []
  },

  onShow() {
    this.loadYieldLog();
  },

  async loadYieldLog() {
    this.setData({ loading: true });
    try {
      const resp = await get('/score/yield-log');
      if (!resp) return;

      // 为每个记录的玩家添加头像 fallback
      const records = (resp.records || []).map(record => ({
        ...record,
        players: (record.players || []).map(p => ({
          ...p,
          avatarBgColor: getColor(p.nickname),
          avatarChar: getFirstChar(p.nickname)
        }))
      }));

      this.setData({
        netYield: resp.netYield || 0,
        sampleCount: resp.sampleCount || 0,
        curveUnlockCount: resp.curveUnlockCount || 2,
        curveData: resp.curveData || [],
        records
      });
    } catch (e) {
      console.error('加载积分流水失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onRoomTap(e) {
    const { roomId } = e.currentTarget.dataset;
    if (!roomId) return;
    wx.navigateTo({
      url: '/pages/settle/settle?roomId=' + roomId,
      fail: () => {
        wx.showToast({ title: '对局档案加载失败', icon: 'none' });
      }
    });
  },

  onPullDownRefresh() {
    this.loadYieldLog().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onAvatarError(e) {
    const { roomId, userId } = e.currentTarget.dataset;
    const records = this.data.records.map(record => {
      if (String(record.roomId) !== String(roomId)) return record;
      return {
        ...record,
        players: record.players.map(p => {
          if (String(p.userId) !== String(userId)) return p;
          return { ...p, avatarUrl: '' };
        })
      };
    });
    this.setData({ records });
  }
});
```

- [ ] **Step 3: score-records.wxml**

完整重写，终端风格布局。

```xml
<scroll-view
  class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}"
  scroll-y
  enhanced
  show-scrollbar="{{false}}"
  refresher-enabled
  refresher-triggered="{{loading}}"
  bindrefresherrefresh="onPullDownRefresh"
>

  <!-- 终端标题 -->
  <view class="terminal-header">
    <text class="terminal-kicker">NET YIELD LOG</text>
    <text class="terminal-title">积分流水</text>
    <view class="terminal-line"></view>
  </view>

  <!-- 加载中 -->
  <view class="loading-state" wx:if="{{loading && records.length === 0}}">
    <view class="loading-spinner"></view>
    <text class="loading-text">SYNCING YIELD LOG...</text>
  </view>

  <!-- 空状态 -->
  <view class="empty-state" wx:elif="{{!loading && records.length === 0 && sampleCount === 0}}">
    <text class="empty-kicker">NO MATCH DATA</text>
    <text class="empty-text">暂无对局数据</text>
    <text class="empty-hint">完成一次结算后，积分流水将写入身份终端</text>
  </view>

  <!-- 有数据时 -->
  <block wx:if="{{records.length > 0 || sampleCount > 0}}">

    <!-- 收益摘要卡 -->
    <view class="yield-summary-card">
      <text class="card-kicker">NET YIELD</text>
      <text class="card-label">近期净收益</text>
      <view class="yield-value {{netYield > 0 ? 'text-positive' : netYield < 0 ? 'text-negative' : 'text-zero'}}">
        {{netYield > 0 ? '+' : ''}}{{netYield}}
      </view>
    </view>

    <!-- 采样状态 -->
    <view class="sample-card">
      <text class="card-kicker">SAMPLE STATUS</text>
      <text class="card-label">采样状态</text>
      <view class="sample-progress">
        <text class="sample-current">{{sampleCount}}</text>
        <text class="sample-sep">/</text>
        <text class="sample-target">{{curveUnlockCount}}</text>
      </view>
    </view>

    <!-- 曲线区域 -->
    <view class="curve-section">
      <!-- 样本不足：锁定卡 -->
      <view class="curve-locked-card" wx:if="{{sampleCount < curveUnlockCount}}">
        <text class="locked-kicker">CURVE LOCKED</text>
        <text class="locked-text">收益曲线未解锁</text>
        <text class="locked-sub">当前样本：{{sampleCount}} / {{curveUnlockCount}}</text>
        <text class="locked-hint">完成至少 {{curveUnlockCount}} 场结算后，系统将生成收益曲线。</text>
      </view>
      <!-- 样本充足：曲线图 -->
      <view class="curve-chart-card" wx:else>
        <text class="card-kicker">YIELD CURVE</text>
        <text class="card-label">收益曲线</text>
        <yield-chart points="{{curveData}}" />
      </view>
    </view>

    <!-- 对局记录 -->
    <view class="match-log-header">
      <text class="card-kicker">MATCH LOG</text>
      <text class="card-label">对局记录</text>
    </view>

    <view class="room-list">
      <view
        class="match-card"
        wx:for="{{records}}"
        wx:key="roomId"
        data-room-id="{{item.roomId}}"
        bindtap="onRoomTap"
      >
        <view class="match-card__header">
          <text class="match-card__room">ROOM {{item.roomNo}}</text>
          <text class="match-card__time">{{item.settledAt}}</text>
        </view>
        <view class="match-card__result">
          <text class="match-card__label">MATCH RESULT</text>
          <text class="match-card__label-cn">对局结果</text>
        </view>
        <view class="match-card__players">
          <view
            class="match-player"
            wx:for="{{item.players}}"
            wx:for-item="p"
            wx:key="userId"
          >
            <view class="match-player__role {{p.isMe ? 'role-me' : 'role-opponent'}}">
              {{p.isMe ? '我' : '对手'}}
            </view>
            <view class="match-player__avatar" style="background:{{p.avatarBgColor}};" wx:if="{{!p.avatarUrl}}">
              <text class="match-player__char">{{p.avatarChar}}</text>
            </view>
            <image
              wx:else
              class="match-player__img"
              src="{{p.avatarUrl}}"
              mode="aspectFill"
              binderror="onAvatarError"
              data-room-id="{{item.roomId}}"
              data-user-id="{{p.userId}}"
            />
            <text class="match-player__name">{{p.nickname}}</text>
            <text class="match-player__score {{p.score > 0 ? 'positive' : p.score < 0 ? 'negative' : ''}}">{{p.score > 0 ? '+' : ''}}{{p.score}}</text>
          </view>
        </view>
        <view class="match-card__footer">
          <text class="match-card__footer-label">VIEW MATCH DOSSIER</text>
          <text class="match-card__footer-cn">查看对局档案</text>
          <view class="svg-icon svg-icon--arrow-sm"></view>
        </view>
      </view>
    </view>

  </block>

</scroll-view>
```

- [ ] **Step 4: score-records.wxss**

完整重写，终端风格。

```css
/* ===== 页面容器 ===== */
.page-container {
  height: 100vh;
  background:
    radial-gradient(circle at 20% 0%, rgba(10, 132, 255, 0.08), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94, 92, 230, 0.05), transparent 30%),
    #0A0A0A;
  padding: 24rpx;
  box-sizing: border-box;
}

/* ===== 终端标题 ===== */
.terminal-header {
  margin-bottom: 32rpx;
}

.terminal-kicker {
  display: block;
  font-size: 20rpx;
  font-weight: 600;
  color: rgba(0, 175, 255, 0.72);
  letter-spacing: 4rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.terminal-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  margin-top: 4rpx;
}

.terminal-line {
  height: 1rpx;
  background: linear-gradient(90deg, rgba(0, 175, 255, 0.30), transparent);
  margin-top: 16rpx;
}

/* ===== 加载 / 空态 ===== */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 3rpx solid rgba(0, 175, 255, 0.15);
  border-top-color: #00AFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 22rpx;
  color: rgba(0, 175, 255, 0.56);
  letter-spacing: 3rpx;
  margin-top: 24rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.empty-kicker {
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.56);
  letter-spacing: 3rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8rpx;
}

.empty-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.28);
}

/* ===== 收益摘要卡 ===== */
.yield-summary-card {
  background: rgba(255, 255, 255, 0.035);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  border-radius: 18rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.card-kicker {
  display: block;
  font-size: 18rpx;
  font-weight: 600;
  color: rgba(0, 175, 255, 0.72);
  letter-spacing: 4rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.card-label {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 2rpx;
  margin-top: 2rpx;
  margin-bottom: 8rpx;
}

.yield-value {
  font-size: 72rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
  line-height: 1.1;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.text-positive {
  color: #36FF74;
}

.text-negative {
  color: #FF4D4F;
}

.text-zero {
  color: rgba(255, 255, 255, 0.85);
}

/* ===== 采样状态卡 ===== */
.sample-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 18rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.sample-progress {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  margin-top: 4rpx;
}

.sample-current {
  font-size: 40rpx;
  font-weight: 700;
  color: #00AFFF;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.sample-sep {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.24);
  font-family: 'SF Mono', 'Courier New', monospace;
}

.sample-target {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.38);
  font-family: 'SF Mono', 'Courier New', monospace;
}

/* ===== 曲线区域 ===== */
.curve-section {
  margin-bottom: 32rpx;
}

.curve-locked-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  border-radius: 18rpx;
  padding: 40rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.curve-locked-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(0, 175, 255, 0.15), transparent);
  animation: scanLine 3s ease-in-out infinite;
}

@keyframes scanLine {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

.reduce-motion .curve-locked-card::after {
  animation: none;
  opacity: 0.5;
}

.locked-kicker {
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.56);
  letter-spacing: 4rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
  margin-bottom: 12rpx;
}

.locked-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8rpx;
}

.locked-sub {
  font-size: 24rpx;
  color: #00AFFF;
  font-family: 'SF Mono', 'Courier New', monospace;
  margin-bottom: 12rpx;
}

.locked-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.28);
}

.curve-chart-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  border-radius: 18rpx;
  padding: 24rpx;
}

/* ===== 对局记录 ===== */
.match-log-header {
  margin-bottom: 20rpx;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.match-card {
  background: rgba(255, 255, 255, 0.035);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  border-radius: 18rpx;
  padding: 28rpx;
}

.match-card:active {
  background: rgba(0, 175, 255, 0.06);
}

.match-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.match-card__room {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 2rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.match-card__time {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.38);
  font-family: 'SF Mono', 'Courier New', monospace;
}

.match-card__result {
  margin-bottom: 16rpx;
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.match-card__label {
  font-size: 18rpx;
  font-weight: 600;
  color: #00AFFF;
  letter-spacing: 3rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.match-card__label-cn {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.35);
}

.match-card__players {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.match-player {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.match-player__role {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
  flex-shrink: 0;
  min-width: 48rpx;
  text-align: center;
}

.role-me {
  color: #00AFFF;
  border: 1rpx solid rgba(0, 175, 255, 0.30);
  background: rgba(0, 175, 255, 0.08);
}

.role-opponent {
  color: rgba(255, 255, 255, 0.38);
  border: 1rpx solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.03);
}

.match-player__avatar {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.match-player__char {
  font-size: 20rpx;
  color: #fff;
  font-weight: 600;
}

.match-player__img {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.match-player__name {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-player__score {
  font-size: 28rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'SF Mono', 'Courier New', monospace;
  flex-shrink: 0;
  text-align: right;
  min-width: 80rpx;
}

.match-player__score.positive {
  color: #36FF74;
}

.match-player__score.negative {
  color: #FF4D4F;
}

.match-card__footer {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.match-card__footer-label {
  font-size: 18rpx;
  color: #00AFFF;
  letter-spacing: 2rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
  opacity: 0.7;
}

.match-card__footer-cn {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.35);
  flex: 1;
}

.svg-icon {
  width: 40rpx;
  height: 40rpx;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex-shrink: 0;
}

.svg-icon--arrow-sm {
  width: 20rpx;
  height: 20rpx;
  opacity: 0.3;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300AFFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 6l6 6-6 6'/%3E%3C/svg%3E");
}
```

- [ ] **Step 5: 验证前端无语法错误**

在微信开发者工具中编译检查，确保无报错。

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/score-records/
git commit -m "feat(score-records): 重写为积分流水终端风格"
```

---

### Task 6: 验收检查

- [ ] **Step 1: 后端编译验证**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 2: 前端页面功能验证**

在微信开发者工具中打开积分记录页，检查：
1. 页面顶部有 `NET YIELD LOG / 积分流水` 终端标题
2. 收益摘要卡显示净收益数字，正绿/负红/零白
3. 采样状态卡显示 `SAMPLE STATUS` + 进度
4. 样本不足时显示 `CURVE LOCKED` 锁定卡（非空白）
5. 样本充足时显示 yield-chart 曲线图
6. 对局卡片时间格式为 `YYYY.MM.DD HH:mm`
7. 当前用户有「我」蓝色标签
8. 分数右对齐，正绿负红
9. 底部有 `VIEW MATCH DOSSIER / 查看对局档案` 按钮
10. 点击卡片跳转 settle 页
11. 页面整体视觉与镜像页一致

- [ ] **Step 3: 下拉刷新验证**

下拉页面，显示 `SYNCING YIELD LOG...` 提示，数据刷新后恢复。

- [ ] **Step 4: 空状态验证**

无数据时显示 `NO MATCH DATA / 暂无对局数据` 终端风空状态。
