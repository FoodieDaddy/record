# Identity Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the profile page as a cyberpunk "Identity Terminal" with backend-powered identity level system and stability metric.

**Architecture:** Backend adds `GET /user/identity-level` endpoint backed by a new `user_identity_level` table. Level and stability are recalculated asynchronously on room settle. Frontend fully rewrites the profile page with 9 terminal-style modules and a new color scheme.

**Tech Stack:** Java 21, Spring Boot 3.2.5, MyBatis-Plus, MySQL, Redis, WeChat Miniprogram (native)

---

## File Structure

### Backend (new)
| File | Responsibility |
|---|---|
| `backend/src/main/resources/sql/migration_identity_level.sql` | DDL for `user_identity_level` table |
| `backend/src/main/java/com/smartrecord/entity/UserIdentityLevel.java` | Entity |
| `backend/src/main/java/com/smartrecord/mapper/UserIdentityLevelMapper.java` | MyBatis-Plus mapper |
| `backend/src/main/java/com/smartrecord/dto/user/IdentityLevelResp.java` | Response DTO |
| `backend/src/main/java/com/smartrecord/service/IdentityLevelService.java` | Service interface |
| `backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java` | Service impl (level rules + stability calc) |

### Backend (modify)
| File | Change |
|---|---|
| `backend/src/main/java/com/smartrecord/controller/UserController.java` | Add `GET /user/identity-level` endpoint |
| `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java` | Hook async level recalc into both settle methods |

### Frontend (modify)
| File | Change |
|---|---|
| `miniprogram/pages/profile/profile.js` | Add `loadIdentityLevel()`, update data model |
| `miniprogram/pages/profile/profile.wxml` | Full rewrite — 9 terminal modules |
| `miniprogram/pages/profile/profile.wxss` | Full rewrite — new color scheme + layouts |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/src/main/resources/sql/migration_identity_level.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 身份等级表
CREATE TABLE IF NOT EXISTS user_identity_level (
  user_id    BIGINT PRIMARY KEY COMMENT '用户ID',
  level      INT NOT NULL DEFAULT 1 COMMENT '等级 1-5',
  exp        INT NOT NULL DEFAULT 0 COMMENT '经验值',
  stability  INT DEFAULT NULL COMMENT '人格稳定度 0-100',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(user_id)
) COMMENT '用户身份等级';
```

- [ ] **Step 2: Execute the migration**

Run in MySQL (port 13306):
```bash
mysql -h 127.0.0.1 -P 13306 -u root -proot smart_record < backend/src/main/resources/sql/migration_identity_level.sql
```

- [ ] **Step 3: Verify table exists**

```bash
mysql -h 127.0.0.1 -P 13306 -u root -proot smart_record -e "DESCRIBE user_identity_level;"
```

Expected: 5 columns (user_id, level, exp, stability, updated_at)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/sql/migration_identity_level.sql
git commit -m "feat: 新增 user_identity_level 建表迁移"
```

---

## Task 2: Backend Entity + Mapper

**Files:**
- Create: `backend/src/main/java/com/smartrecord/entity/UserIdentityLevel.java`
- Create: `backend/src/main/java/com/smartrecord/mapper/UserIdentityLevelMapper.java`

- [ ] **Step 1: Create entity class**

```java
package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_identity_level")
public class UserIdentityLevel {

    @TableId(type = IdType.ASSIGN_ID)
    private Long userId;

    private Integer level;

    private Integer exp;

    private Integer stability;

    @TableField(fill = TableField.FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 2: Create mapper interface**

```java
package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.UserIdentityLevel;

public interface UserIdentityLevelMapper extends BaseMapper<UserIdentityLevel> {
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/smartrecord/entity/UserIdentityLevel.java \
        backend/src/main/java/com/smartrecord/mapper/UserIdentityLevelMapper.java
git commit -m "feat: 身份等级 entity + mapper"
```

---

## Task 3: Backend DTO

**Files:**
- Create: `backend/src/main/java/com/smartrecord/dto/user/IdentityLevelResp.java`

- [ ] **Step 1: Create response DTO**

```java
package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "身份等级响应")
public class IdentityLevelResp {

    @Schema(description = "当前等级 1-5", example = "2")
    private Integer level;

    @Schema(description = "等级称号", example = "桌面参与者")
    private String title;

    @Schema(description = "当前经验值", example = "280")
    private Integer exp;

    @Schema(description = "下一级所需经验", example = "500")
    private Integer nextLevelExp;

    @Schema(description = "当前等级进度百分比 0-100", example = "56")
    private Integer progress;

    @Schema(description = "人格稳定度 0-100，null 表示数据不足", example = "72")
    private Integer stability;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/java/com/smartrecord/dto/user/IdentityLevelResp.java
git commit -m "feat: IdentityLevelResp DTO"
```

---

## Task 4: Backend Service

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/IdentityLevelService.java`
- Create: `backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java`

- [ ] **Step 1: Create service interface**

```java
package com.smartrecord.service;

import com.smartrecord.dto.user.IdentityLevelResp;

public interface IdentityLevelService {

    /**
     * 获取用户身份等级（优先读缓存，无缓存时实时计算）
     */
    IdentityLevelResp getIdentityLevel(Long userId);

    /**
     * 重新计算指定用户的身份等级（settle 后异步调用）
     */
    void recalculate(Long userId);
}
```

- [ ] **Step 2: Create service implementation**

```java
package com.smartrecord.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.dto.user.IdentityLevelResp;
import com.smartrecord.entity.UserIdentityLevel;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserDetailMapper;
import com.smartrecord.mapper.UserIdentityLevelMapper;
import com.smartrecord.mapper.UserMirrorProfileMapper;
import com.smartrecord.entity.UserDetail;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.service.IdentityLevelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdentityLevelServiceImpl implements IdentityLevelService {

    private final UserIdentityLevelMapper identityLevelMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final UserMirrorProfileMapper mirrorProfileMapper;

    // 等级规则：{最低对局数, 最低积分, 需要MBTI}
    private static final int[][] LEVEL_RULES = {
        {0, 0, 0},       // Lv.1 新人观察员
        {5, 0, 0},       // Lv.2 桌面参与者
        {20, 100, 0},    // Lv.3 策略执行者
        {50, 0, 0},      // Lv.4 局势掌控者（胜率在方法内判断）
        {100, 0, 1}      // Lv.5 法雷达候选者（需要MBTI）
    };

    private static final String[] LEVEL_TITLES = {
        "新人观察员", "桌面参与者", "策略执行者", "局势掌控者", "法雷达候选者"
    };

    private static final int[] LEVEL_EXP = {0, 100, 500, 1500, 4000, 8000};

    @Override
    public IdentityLevelResp getIdentityLevel(Long userId) {
        UserIdentityLevel record = identityLevelMapper.selectById(userId);
        if (record == null) {
            // 首次访问，实时计算并持久化
            record = recalculateInternal(userId);
        }
        return toResp(record);
    }

    @Override
    public void recalculate(Long userId) {
        recalculateInternal(userId);
    }

    private UserIdentityLevel recalculateInternal(Long userId) {
        // 1. 查询对局统计
        Integer matchCount = roomMemberMapper.selectCount(
            new LambdaQueryWrapper<RoomMember>()
                .eq(RoomMember::getUserId, userId)
                .isNotNull(RoomMember::getQuitTime)
        );

        // 2. 查询累计净积分
        List<RoomMember> settled = roomMemberMapper.selectList(
            new LambdaQueryWrapper<RoomMember>()
                .eq(RoomMember::getUserId, userId)
                .isNotNull(RoomMember::getQuitTime)
                .select(RoomMember::getFinalScore)
        );
        int totalScore = settled.stream()
            .mapToInt(rm -> rm.getFinalScore() != null ? rm.getFinalScore() : 0)
            .sum();

        // 3. 查询胜率（净得分 > 0 的场次）
        long wins = settled.stream()
            .filter(rm -> rm.getFinalScore() != null && rm.getFinalScore() > 0)
            .count();
        int winRate = matchCount > 0 ? (int) ((wins * 100) / matchCount) : 0;

        // 4. 查询 MBTI 校准状态
        UserMirrorProfile profile = mirrorProfileMapper.selectById(userId);
        boolean mbtiCalibrated = profile != null && profile.getMbtiCode() != null;

        // 5. 计算等级
        int level = 1;
        for (int i = LEVEL_RULES.length - 1; i >= 0; i--) {
            int[] rule = LEVEL_RULES[i];
            boolean match = matchCount >= rule[0];
            if (rule[1] > 0) match = match && totalScore >= rule[1];
            if (rule[2] > 0) match = match && mbtiCalibrated;
            // Lv.4 特殊判断：胜率 >= 50%
            if (i == 3) match = match && winRate >= 50;
            if (match) { level = i + 1; break; }
        }

        // 6. 计算经验值
        int exp = matchCount * 10 + Math.max(0, totalScore) + (mbtiCalibrated ? 200 : 0);

        // 7. 计算稳定度
        Integer stability = null;
        if (matchCount >= 3) {
            List<Integer> scores = settled.stream()
                .map(rm -> rm.getFinalScore() != null ? rm.getFinalScore() : 0)
                .toList();
            stability = computeStability(scores);
        }

        // 8. 持久化
        UserIdentityLevel record = new UserIdentityLevel();
        record.setUserId(userId);
        record.setLevel(level);
        record.setExp(exp);
        record.setStability(stability);

        UserIdentityLevel existing = identityLevelMapper.selectById(userId);
        if (existing != null) {
            identityLevelMapper.updateById(record);
        } else {
            identityLevelMapper.insert(record);
        }

        log.info("重算身份等级: userId={}, level={}, exp={}, stability={}", userId, level, exp, stability);
        return record;
    }

    private int computeStability(List<Integer> scores) {
        int n = scores.size();
        double mean = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
        double variance = scores.stream()
            .mapToDouble(s -> Math.pow(s - mean, 2))
            .average()
            .orElse(0);
        double sigma = Math.sqrt(variance);
        // σ=0 → 100分, σ=50 → 0分
        return Math.max(0, Math.min(100, (int) Math.round(100 - sigma * 2.0)));
    }

    private IdentityLevelResp toResp(UserIdentityLevel record) {
        int level = record.getLevel();
        int exp = record.getExp();
        int currentBase = LEVEL_EXP[level - 1];
        int nextBase = level < 5 ? LEVEL_EXP[level] : LEVEL_EXP[4];
        int progress = level >= 5 ? 100 :
            (nextBase > currentBase ? Math.min(100, (int) (((long)(exp - currentBase) * 100) / (nextBase - currentBase))) : 0);

        return IdentityLevelResp.builder()
            .level(level)
            .title(LEVEL_TITLES[level - 1])
            .exp(exp)
            .nextLevelExp(nextBase)
            .progress(Math.max(0, progress))
            .stability(record.getStability())
            .build();
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/smartrecord/service/IdentityLevelService.java \
        backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java
git commit -m "feat: IdentityLevelService 等级规则 + 稳定度计算"
```

---

## Task 5: Backend Controller Endpoint

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/controller/UserController.java`

- [ ] **Step 1: Add dependency injection**

In the `UserController` class, add field:
```java
private final IdentityLevelService identityLevelService;
```

Add import:
```java
import com.smartrecord.service.IdentityLevelService;
```

(Lombok `@RequiredArgsConstructor` will auto-inject it.)

- [ ] **Step 2: Add endpoint method**

```java
@Operation(summary = "获取身份等级")
@GetMapping("/identity-level")
public Result<IdentityLevelResp> getIdentityLevel(HttpServletRequest request) {
    Long userId = (Long) request.getAttribute("currentUserId");
    return Result.ok(identityLevelService.getIdentityLevel(userId));
}
```

Add import:
```java
import com.smartrecord.dto.user.IdentityLevelResp;
```

- [ ] **Step 3: Verify compilation**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/smartrecord/controller/UserController.java
git commit -m "feat: GET /user/identity-level 端点"
```

---

## Task 6: Settle Hook — Async Level Recalculation

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java`

- [ ] **Step 1: Add dependency**

In `ScoreServiceImpl`, add field:
```java
private final IdentityLevelService identityLevelService;
```

Add import:
```java
import com.smartrecord.service.IdentityLevelService;
```

(Lombok `@RequiredArgsConstructor` handles injection.)

- [ ] **Step 2: Hook into `doSettleRoom` (line ~526, before return)**

After `lastTtlRefresh.remove(roomId);` and before the `return SettleResp.builder()...` block, insert:

```java
// 异步重算身份等级（非关键路径）
final var settledUserIds = new ArrayList<>(playerTotalMap.keySet());
asyncExecutor.execute(() -> {
    for (Long uid : settledUserIds) {
        try {
            identityLevelService.recalculate(uid);
        } catch (Exception e) {
            log.warn("异步重算身份等级失败: userId={}", uid, e);
        }
    }
});
```

- [ ] **Step 3: Hook into `doSettleRoundRecordRoom` (similar location before return)**

In `doSettleRoundRecordRoom`, find the analogous location before the return statement (after Redis cleanup and WS notification). Insert the same block:

```java
// 异步重算身份等级（非关键路径）
final var settledUserIds2 = new ArrayList<>(playerTotalMap.keySet());
asyncExecutor.execute(() -> {
    for (Long uid : settledUserIds2) {
        try {
            identityLevelService.recalculate(uid);
        } catch (Exception e) {
            log.warn("异步重算身份等级失败: userId={}", uid, e);
        }
    }
});
```

- [ ] **Step 4: Verify compilation**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java
git commit -m "feat: settle 后异步重算身份等级"
```

---

## Task 7: Frontend — Profile JS (data layer)

**Files:**
- Modify: `miniprogram/pages/profile/profile.js`

- [ ] **Step 1: Update data model**

Replace the `data` object with:

```js
data: {
  isLoggedIn: false,
  nickname: '',
  avatarUrl: '',
  avatarColor: '',
  avatarChar: '',
  saving: false,
  _lastSavedNickname: '',
  _lastSavedAvatar: '',

  // 身份信息
  playerCode: '',
  daysSinceJoined: 0,

  // 积分统计
  totalScore: 0,
  winRate: 0,
  matchCount: 0,

  // 身份等级
  level: 1,
  levelTitle: '新人观察员',
  levelExp: 0,
  nextLevelExp: 100,
  levelProgress: 0,
  stability: null,

  // 镜像数据
  mbtiType: '',
  mbtiTitle: '',
  mbtiCalibrated: false,
  traits: [],

  // 战斗人格维度
  battleDimensions: [],

  // 身份摘要
  identityStrengths: '',
  identityWarnings: '',

  // 成就
  achievements: [],

  // 动画开关
  animationEnabled: true
}
```

- [ ] **Step 2: Add loadIdentityLevel method**

```js
async loadIdentityLevel() {
  try {
    const res = await get('/user/identity-level');
    if (!res) return;
    this.setData({
      level: res.level || 1,
      levelTitle: res.title || '新人观察员',
      levelExp: res.exp || 0,
      nextLevelExp: res.nextLevelExp || 100,
      levelProgress: res.progress || 0,
      stability: res.stability
    });
  } catch (e) {
    console.error('加载身份等级失败', e);
  }
},
```

- [ ] **Step 3: Add level badge helper**

```js
getLevelBadge() {
  const badges = ['NEWBIE', 'PLAYER', 'STRATEGIST', 'MASTER', 'LEGEND'];
  return badges[(this.data.level || 1) - 1] || 'NEWBIE';
},
```

- [ ] **Step 4: Update onShow to call loadIdentityLevel**

In `onShow()`, after the `loadMirrorData()` and `loadScoreStats()` calls, add:
```js
this.loadIdentityLevel();
```

- [ ] **Step 5: Update onPullDownRefresh**

In `onPullDownRefresh()`, add `this.loadIdentityLevel()` to the `Promise.all` array:

```js
await Promise.all([
  this.loadUserInfo(),
  this.loadMirrorData(),
  this.loadScoreStats(),
  this.loadIdentityLevel()
]);
```

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/profile/profile.js
git commit -m "feat: profile.js 新增身份等级数据加载"
```

---

## Task 8: Frontend — Profile WXML (full rewrite)

**Files:**
- Modify: `miniprogram/pages/profile/profile.wxml`

- [ ] **Step 1: Replace entire file content**

```xml
<view class="terminal-page {{!animationEnabled ? 'reduce-motion' : ''}}">
  <!-- 未登录 -->
  <view wx:if="{{!isLoggedIn}}" class="empty-state">
    <view class="empty-state__icon">
      <view class="svg-icon svg-icon--lock"></view>
    </view>
    <text class="empty-state__title">尚未登录</text>
    <text class="empty-state__desc">登录后即可管理个人信息</text>
    <button class="btn-primary" style="width:320rpx;" bindtap="goLogin">去登录</button>
  </view>

  <!-- 已登录 -->
  <view wx:else>
    <view class="terminal__glow" aria-hidden="true"></view>

    <!-- 0. SYSTEM STATUS -->
    <view class="status-bar">
      <view class="status-bar__dot {{isLoggedIn ? 'status-bar__dot--online' : ''}}"></view>
      <text class="status-bar__label">SYSTEM STATUS</text>
      <text class="status-bar__value">{{isLoggedIn ? 'ONLINE' : 'OFFLINE'}}</text>
    </view>

    <!-- 1. PLAYER PROFILE -->
    <view class="term-card term-card--identity">
      <text class="term-kicker">PLAYER PROFILE</text>
      <text class="term-kicker-sub">玩家身份档案</text>
      <view class="identity__row">
        <button class="identity__avatar-btn" open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">
          <view class="identity__avatar-ring">
            <view class="identity__avatar-auto" style="background:{{avatarColor}};" wx:if="{{!avatarUrl}}">
              <text class="identity__avatar-char">{{avatarChar}}</text>
            </view>
            <image class="identity__avatar-img" src="{{avatarUrl}}" wx:else></image>
          </view>
        </button>
        <view class="identity__info">
          <view class="identity__name-row">
            <input
              class="identity__name-input"
              type="nickname"
              value="{{nickname}}"
              placeholder="点击授权昵称"
              maxlength="6"
              bindinput="onNicknameInput"
              bindblur="onNicknameBlur"
            />
            <view class="identity__level-badge">Lv.{{level}}</view>
            <view class="identity__dice-btn" bindtap="shuffleNickname">
              <view class="svg-icon svg-icon--dice"></view>
            </view>
          </view>
          <text class="identity__player-code">{{playerCode}}</text>
        </view>
      </view>
      <view class="identity__meta">
        <view class="identity__meta-col">
          <text class="identity__meta-label">加入时间</text>
          <text class="identity__meta-value">{{daysSinceJoined}} Days</text>
        </view>
        <view class="identity__meta-col">
          <text class="identity__meta-label">累计对局</text>
          <text class="identity__meta-value">{{matchCount}} Matches</text>
        </view>
        <view class="identity__meta-col">
          <text class="identity__meta-label">状态</text>
          <text class="identity__meta-value identity__meta-value--active">ACTIVE</text>
        </view>
      </view>
      <text class="identity__saving" wx:if="{{saving}}">保存中...</text>
    </view>

    <!-- 2. DATA MATRIX -->
    <view class="term-card term-card--stats">
      <text class="term-kicker">DATA MATRIX</text>
      <text class="term-kicker-sub">数据矩阵</text>
      <view class="stats-grid">
        <view class="stats-cell">
          <text class="stats-cell__label">NET YIELD</text>
          <text class="stats-cell__value {{totalScore >= 0 ? 'stats-cell__value--positive' : 'stats-cell__value--negative'}}">{{totalScore}}</text>
          <text class="stats-cell__sub">累计收益</text>
        </view>
        <view class="stats-cell">
          <text class="stats-cell__label">WIN RATE</text>
          <text class="stats-cell__value">{{winRate}}%</text>
          <text class="stats-cell__sub">胜率</text>
        </view>
        <view class="stats-cell">
          <text class="stats-cell__label">MATCHES</text>
          <text class="stats-cell__value">{{matchCount}}</text>
          <text class="stats-cell__sub">样本数</text>
        </view>
        <view class="stats-cell">
          <text class="stats-cell__label">STABILITY</text>
          <text class="stats-cell__value">{{stability !== null ? stability : '--'}}</text>
          <text class="stats-cell__sub">人格稳定度</text>
        </view>
      </view>
    </view>

    <!-- 3. IDENTITY LEVEL -->
    <view class="term-card term-card--level">
      <text class="term-kicker">IDENTITY LEVEL</text>
      <text class="term-kicker-sub">身份等级</text>
      <view class="level__header">
        <text class="level__lv">Lv.{{level}}</text>
        <text class="level__title">{{levelTitle}}</text>
      </view>
      <view class="level__bar-track">
        <view class="level__bar-fill" style="width:{{levelProgress}}%;"></view>
      </view>
      <view class="level__exp-row">
        <text class="level__exp-text">EXP {{levelExp}} / {{nextLevelExp}}</text>
        <text class="level__exp-pct">{{levelProgress}}%</text>
      </view>
      <view class="level__route">
        <view class="level__node {{level >= 1 ? 'level__node--done' : ''}} {{level == 1 ? 'level__node--current' : ''}}">
          <view class="level__node-dot"></view>
          <text class="level__node-label">观察员</text>
        </view>
        <view class="level__node-line {{level >= 2 ? 'level__node-line--done' : ''}}"></view>
        <view class="level__node {{level >= 2 ? 'level__node--done' : ''}} {{level == 2 ? 'level__node--current' : ''}}">
          <view class="level__node-dot"></view>
          <text class="level__node-label">参与者</text>
        </view>
        <view class="level__node-line {{level >= 3 ? 'level__node-line--done' : ''}}"></view>
        <view class="level__node {{level >= 3 ? 'level__node--done' : ''}} {{level == 3 ? 'level__node--current' : ''}}">
          <view class="level__node-dot"></view>
          <text class="level__node-label">执行者</text>
        </view>
        <view class="level__node-line {{level >= 4 ? 'level__node-line--done' : ''}}"></view>
        <view class="level__node {{level >= 4 ? 'level__node--done' : ''}} {{level == 4 ? 'level__node--current' : ''}}">
          <view class="level__node-dot"></view>
          <text class="level__node-label">掌控者</text>
        </view>
        <view class="level__node-line {{level >= 5 ? 'level__node-line--done' : ''}}"></view>
        <view class="level__node {{level >= 5 ? 'level__node--done' : ''}} {{level == 5 ? 'level__node--current' : ''}}">
          <view class="level__node-dot"></view>
          <text class="level__node-label">候选者</text>
        </view>
      </view>
    </view>

    <!-- 4. PERSONA PROTOCOL -->
    <view class="term-card term-card--persona" wx:if="{{mbtiCalibrated}}">
      <text class="term-kicker">PERSONA PROTOCOL</text>
      <text class="term-kicker-sub">人格协议</text>
      <view class="persona__main">
        <view class="persona__left">
          <text class="persona__type">{{mbtiType}}</text>
          <text class="persona__title">{{mbtiTitle}}</text>
        </view>
        <view class="persona__sync-badge">
          <view class="persona__sync-dot"></view>
          <text>SYNCED</text>
        </view>
      </view>
      <view class="persona__rows">
        <view class="persona__row">
          <text class="persona__row-label">偏差监测</text>
          <text class="persona__row-value">LOCKED</text>
        </view>
        <view class="persona__row">
          <text class="persona__row-label">数据来源</text>
          <text class="persona__row-value">MBTI + 战绩镜像</text>
        </view>
      </view>
      <view class="persona__traits">
        <text class="persona__trait" wx:for="{{traits}}" wx:key="*this">{{item}}</text>
      </view>
    </view>

    <!-- 未校准时 -->
    <view class="term-card term-card--persona term-card--dim" wx:if="{{!mbtiCalibrated}}">
      <text class="term-kicker">PERSONA PROTOCOL</text>
      <text class="term-kicker-sub">人格协议</text>
      <text class="term-empty-text">完成 MBTI 校准后解锁人格模块</text>
    </view>

    <!-- 5. IDENTITY SUMMARY -->
    <view class="term-card term-card--summary" wx:if="{{mbtiCalibrated}}">
      <text class="term-kicker">IDENTITY SUMMARY</text>
      <text class="term-kicker-sub">身份摘要</text>
      <view class="summary__header">
        <text class="summary__type">{{mbtiType}}</text>
        <text class="summary__title">{{mbtiTitle}}</text>
      </view>
      <view class="summary__section">
        <text class="summary__label summary__label--strength">擅长</text>
        <text class="summary__text">{{identityStrengths}}</text>
      </view>
      <view class="summary__section">
        <text class="summary__label summary__label--warning">警惕</text>
        <text class="summary__text">{{identityWarnings}}</text>
      </view>
      <view class="summary__caution" wx:if="{{matchCount < 3}}">
        <text class="summary__caution-text">样本不足，结论仅供参考</text>
      </view>
    </view>

    <!-- 6. BADGE COLLECTION -->
    <view class="term-card term-card--achievements">
      <text class="term-kicker">BADGE COLLECTION</text>
      <text class="term-kicker-sub">成就徽章库</text>
      <scroll-view class="achievements-scroll" scroll-x="true" enhanced="true" show-scrollbar="false">
        <view class="achievements-track">
          <view class="achievement-badge {{item.unlocked ? 'achievement-badge--on' : ''}}" wx:for="{{achievements}}" wx:key="key">
            <view class="achievement-badge__icon">
              <view class="achievement-badge__ring"></view>
            </view>
            <text class="achievement-badge__label">{{item.label}}</text>
            <text class="achievement-badge__sub">{{item.sub}}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 7. ARCHIVES -->
    <view class="term-card term-card--archives">
      <text class="term-kicker">ARCHIVES</text>
      <text class="term-kicker-sub">档案库</text>
      <view class="archive-row" bindtap="goScoreRecords">
        <view class="archive-row__icon">
          <view class="svg-icon svg-icon--record"></view>
        </view>
        <view class="archive-row__content">
          <text class="archive-row__title">积分记录</text>
          <text class="archive-row__desc">查看全部积分流水</text>
        </view>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
      <view class="archive-row" bindtap="goScoreRecords">
        <view class="archive-row__icon">
          <view class="svg-icon svg-icon--history"></view>
        </view>
        <view class="archive-row__content">
          <text class="archive-row__title">房间历史</text>
          <text class="archive-row__desc">查看历史对局</text>
        </view>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
      <view class="archive-row" bindtap="goBattleFile">
        <view class="archive-row__icon">
          <view class="svg-icon svg-icon--battle"></view>
        </view>
        <view class="archive-row__content">
          <text class="archive-row__title">战绩档案</text>
          <text class="archive-row__desc">查看个人战绩</text>
        </view>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
      <view class="archive-row archive-row--last" bindtap="goExportData">
        <view class="archive-row__icon">
          <view class="svg-icon svg-icon--export"></view>
        </view>
        <view class="archive-row__content">
          <text class="archive-row__title">数据导出</text>
          <text class="archive-row__desc">导出全部身份数据</text>
        </view>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
    </view>

    <!-- 8. SYSTEM CONTROL -->
    <view class="term-card term-card--system">
      <text class="term-kicker">SYSTEM CONTROL</text>
      <text class="term-kicker-sub">系统控制</text>
      <view class="sys-link" bindtap="goSettings">
        <text class="sys-link__zh">设置中心</text>
        <text class="sys-link__en">SYSTEM SETTINGS</text>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
      <view class="sys-link" bindtap="goSettings">
        <text class="sys-link__zh">通知中心</text>
        <text class="sys-link__en">NOTIFICATION</text>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
      <view class="sys-link" bindtap="goSettings">
        <text class="sys-link__zh">声音配置</text>
        <text class="sys-link__en">AUDIO CONFIG</text>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
      <view class="sys-link sys-link--last" bindtap="goSettings">
        <text class="sys-link__zh">关于系统</text>
        <text class="sys-link__en">ABOUT SYSTEM</text>
        <view class="svg-icon svg-icon--arrow"></view>
      </view>
    </view>

    <!-- 9. TERMINATE SESSION -->
    <view class="terminate-btn" bindtap="onLogout">
      <text class="terminate-btn__en">TERMINATE SESSION</text>
      <text class="terminate-btn__zh">结束会话</text>
    </view>
  </view>
</view>
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/profile/profile.wxml
git commit -m "feat: profile.wxml 身份终端全量重写"
```

---

## Task 9: Frontend — Profile WXSS (full rewrite)

**Files:**
- Modify: `miniprogram/pages/profile/profile.wxss`

- [ ] **Step 1: Replace entire file content**

```css
/* ===== SVG 线框图标 ===== */
.svg-icon {
  width: 40rpx;
  height: 40rpx;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex-shrink: 0;
}

.svg-icon--dice {
  width: 36rpx;
  height: 36rpx;
  opacity: 0.6;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='3'/%3E%3Ccircle cx='8' cy='8' r='1' fill='white'/%3E%3Ccircle cx='16' cy='8' r='1' fill='white'/%3E%3Ccircle cx='8' cy='16' r='1' fill='white'/%3E%3Ccircle cx='16' cy='16' r='1' fill='white'/%3E%3Ccircle cx='12' cy='12' r='1' fill='white'/%3E%3C/svg%3E");
}

.svg-icon--arrow {
  width: 24rpx;
  height: 24rpx;
  opacity: 0.3;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 6l6 6-6 6'/%3E%3C/svg%3E");
}

.svg-icon--lock {
  width: 80rpx;
  height: 80rpx;
  opacity: 0.4;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='5' y='11' width='14' height='10' rx='2'/%3E%3Cpath d='M8 11V7a4 4 0 118 0v4'/%3E%3Ccircle cx='12' cy='16' r='1'/%3E%3C/svg%3E");
}

.svg-icon--record {
  width: 40rpx;
  height: 40rpx;
  opacity: 0.7;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300AFFF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cline x1='16' y1='13' x2='8' y2='13'/%3E%3Cline x1='16' y1='17' x2='8' y2='17'/%3E%3C/svg%3E");
}

.svg-icon--history {
  width: 40rpx;
  height: 40rpx;
  opacity: 0.7;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300AFFF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E");
}

.svg-icon--battle {
  width: 40rpx;
  height: 40rpx;
  opacity: 0.7;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300AFFF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/%3E%3C/svg%3E");
}

.svg-icon--export {
  width: 40rpx;
  height: 40rpx;
  opacity: 0.7;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300AFFF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/%3E%3Cpolyline points='7 10 12 15 17 10'/%3E%3Cline x1='12' y1='15' x2='12' y2='3'/%3E%3C/svg%3E");
}


/* ===== 页面根节点 ===== */
.terminal-page {
  --primary: #00AFFF;
  --primary-dim: rgba(0, 170, 255, 0.15);
  --primary-glow: rgba(0, 170, 255, 0.3);
  --card-bg: #0A0F18;
  --card-border: rgba(0, 170, 255, 0.15);
  --card-radius: 18rpx;
  --success: #36FF74;
  --danger: #FF4D4F;
  --text-secondary: #7C8698;

  position: relative;
  padding: 24rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  min-height: 100vh;
  background: #05070A;
}

.terminal__glow {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 800rpx;
  height: 600rpx;
  background:
    radial-gradient(circle at 20% 0%, rgba(0,170,255,0.10), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94,92,230,0.06), transparent 30%);
  pointer-events: none;
  z-index: 0;
}


/* ===== 未登录 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
}

.empty-state__icon { margin-bottom: 32rpx; }

.empty-state__title {
  font-size: 34rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.92);
  margin-bottom: 12rpx;
}

.empty-state__desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 48rpx;
}


/* ===== SYSTEM STATUS ===== */
.status-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 0;
  margin-bottom: 16rpx;
  position: relative;
  z-index: 1;
}

.status-bar__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.24);
  flex-shrink: 0;
}

.status-bar__dot--online {
  background: var(--success);
  box-shadow: 0 0 8rpx rgba(54,255,116,0.5);
  animation: breathe 2s ease-in-out infinite;
}

.status-bar__label {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(255,255,255,0.38);
  font-weight: 600;
}

.status-bar__value {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  color: var(--text-secondary);
  font-family: monospace;
  margin-left: auto;
}


/* ===== 通用卡片 ===== */
.term-card {
  position: relative;
  z-index: 1;
  background: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: var(--card-radius);
  padding: 28rpx;
  margin-bottom: 16rpx;
}

.term-card--dim { opacity: 0.5; }

.term-kicker {
  display: block;
  font-size: 20rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.92);
  letter-spacing: 3rpx;
  margin-bottom: 2rpx;
}

.term-kicker-sub {
  display: block;
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: var(--primary);
  opacity: 0.7;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.term-empty-text {
  font-size: 26rpx;
  color: rgba(255,255,255,0.38);
}


/* ===== 1. PLAYER PROFILE ===== */
.term-card--identity { padding: 28rpx; }

.identity__row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 16rpx;
}

.identity__avatar-btn {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  background: transparent;
  overflow: hidden;
  line-height: normal;
  flex-shrink: 0;
}

.identity__avatar-btn::after { display: none; }

.identity__avatar-ring {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: 2rpx solid var(--primary-dim);
  box-shadow: 0 0 12rpx var(--primary-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.identity__avatar-auto {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.identity__avatar-char {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
}

.identity__avatar-img { width: 100%; height: 100%; }

.identity__info { flex: 1; min-width: 0; }

.identity__name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.identity__name-input {
  flex: 1;
  height: 60rpx;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.92);
  font-size: 30rpx;
  font-weight: 600;
}

.identity__name-input::placeholder { color: rgba(255,255,255,0.38); }

.identity__level-badge {
  font-size: 18rpx;
  font-weight: 600;
  color: var(--primary);
  border: 1rpx solid var(--primary-dim);
  border-radius: 8rpx;
  padding: 4rpx 10rpx;
  letter-spacing: 1rpx;
  background: rgba(0,170,255,0.06);
  flex-shrink: 0;
}

.identity__dice-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.identity__dice-btn:active { opacity: 0.5; }

.identity__player-code {
  display: block;
  font-size: 20rpx;
  color: var(--primary);
  font-family: monospace;
  letter-spacing: 2rpx;
  opacity: 0.7;
  margin-top: 2rpx;
}

.identity__meta {
  display: flex;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(255,255,255,0.06);
}

.identity__meta-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.identity__meta-label {
  font-size: 18rpx;
  color: rgba(255,255,255,0.38);
}

.identity__meta-value {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-family: monospace;
  letter-spacing: 1rpx;
}

.identity__meta-value--active {
  color: var(--success);
}

.identity__saving {
  display: block;
  font-size: 20rpx;
  color: var(--primary);
  margin-top: 6rpx;
  opacity: 0.8;
  animation: pulse 1.2s ease-in-out infinite;
}


/* ===== 2. DATA MATRIX ===== */
.term-card--stats { padding: 24rpx; }

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rpx;
  background: rgba(255,255,255,0.04);
  border-radius: 12rpx;
  overflow: hidden;
}

.stats-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 20rpx 16rpx;
  background: var(--card-bg);
}

.stats-cell__label {
  font-size: 16rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
  font-weight: 500;
}

.stats-cell__value {
  font-size: 44rpx;
  font-weight: 700;
  color: rgba(255,255,255,0.92);
  font-family: monospace;
  letter-spacing: 1rpx;
}

.stats-cell__value--positive { color: var(--success); }
.stats-cell__value--negative { color: var(--danger); }

.stats-cell__sub {
  font-size: 18rpx;
  color: rgba(255,255,255,0.38);
}


/* ===== 3. IDENTITY LEVEL ===== */
.term-card--level { padding: 28rpx; }

.level__header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.level__lv {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--primary);
  font-family: monospace;
  letter-spacing: 2rpx;
}

.level__title {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.level__bar-track {
  width: 100%;
  height: 12rpx;
  background: rgba(255,255,255,0.06);
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 10rpx;
}

.level__bar-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 6rpx;
  box-shadow: 0 0 8rpx var(--primary-glow);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.level__exp-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.level__exp-text {
  font-size: 20rpx;
  color: var(--text-secondary);
  font-family: monospace;
}

.level__exp-pct {
  font-size: 20rpx;
  color: var(--primary);
  font-family: monospace;
}

.level__route {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
}

.level__node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  opacity: 0.3;
}

.level__node--done { opacity: 0.7; }
.level__node--current { opacity: 1; }

.level__node-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255,255,255,0.2);
  background: transparent;
}

.level__node--done .level__node-dot {
  border-color: var(--primary);
  background: var(--primary);
}

.level__node--current .level__node-dot {
  border-color: var(--primary);
  background: var(--primary);
  box-shadow: 0 0 8rpx var(--primary-glow);
  animation: breathe 2s ease-in-out infinite;
}

.level__node-label {
  font-size: 16rpx;
  color: var(--text-secondary);
  white-space: nowrap;
}

.level__node-line {
  flex: 1;
  height: 2rpx;
  background: rgba(255,255,255,0.08);
  margin: 0 4rpx;
  margin-bottom: 22rpx;
}

.level__node-line--done { background: var(--primary); opacity: 0.5; }


/* ===== 4. PERSONA PROTOCOL ===== */
.term-card--persona { border-color: var(--primary-dim); }

.persona__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.persona__left { display: flex; flex-direction: column; gap: 2rpx; }

.persona__type {
  font-size: 44rpx;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: 6rpx;
  font-family: monospace;
}

.persona__title {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.persona__sync-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 18rpx;
  font-weight: 500;
  color: var(--success);
  border: 1rpx solid rgba(54,255,116,0.24);
  border-radius: 8rpx;
  padding: 6rpx 14rpx;
  letter-spacing: 1rpx;
  background: rgba(54,255,116,0.06);
}

.persona__sync-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--success);
}

.persona__rows {
  padding: 12rpx 0;
  border-top: 1rpx solid rgba(255,255,255,0.06);
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  margin-bottom: 14rpx;
}

.persona__row {
  display: flex;
  justify-content: space-between;
  padding: 6rpx 0;
}

.persona__row-label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.38);
}

.persona__row-value {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-family: monospace;
}

.persona__traits {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.persona__trait {
  font-size: 20rpx;
  color: var(--primary);
  border: 1rpx solid var(--primary-dim);
  border-radius: 8rpx;
  padding: 6rpx 14rpx;
  background: rgba(0,170,255,0.04);
  letter-spacing: 1rpx;
}


/* ===== 5. IDENTITY SUMMARY ===== */
.term-card--summary { border-color: var(--primary-dim); }

.summary__header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 16rpx;
  padding-bottom: 14rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
}

.summary__type {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--primary);
  font-family: monospace;
  letter-spacing: 3rpx;
}

.summary__title {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.summary__section { margin-bottom: 14rpx; }
.summary__section:last-of-type { margin-bottom: 0; }

.summary__label {
  display: inline-block;
  font-size: 18rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-bottom: 8rpx;
}

.summary__label--strength {
  color: var(--success);
  background: rgba(54,255,116,0.08);
  border: 1rpx solid rgba(54,255,116,0.2);
}

.summary__label--warning {
  color: #FF9F0A;
  background: rgba(255,159,10,0.08);
  border: 1rpx solid rgba(255,159,10,0.2);
}

.summary__text {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}

.summary__caution {
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(255,255,255,0.06);
}

.summary__caution-text {
  font-size: 20rpx;
  color: #FF9F0A;
  opacity: 0.8;
}


/* ===== 6. BADGE COLLECTION ===== */
.term-card--achievements { padding: 24rpx 0 24rpx 28rpx; }

.achievements-scroll {
  width: 100%;
  white-space: nowrap;
}

.achievements-track {
  display: inline-flex;
  gap: 20rpx;
  padding-right: 28rpx;
}

.achievement-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  width: 130rpx;
  flex-shrink: 0;
  opacity: 0.2;
}

.achievement-badge--on { opacity: 1; }

.achievement-badge__icon {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.achievement-badge__ring {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.02);
}

.achievement-badge--on .achievement-badge__ring {
  border-color: var(--primary);
  background: rgba(0,170,255,0.08);
  box-shadow: 0 0 12rpx var(--primary-dim);
}

.achievement-badge__label {
  font-size: 22rpx;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
}

.achievement-badge--on .achievement-badge__label { color: rgba(255,255,255,0.92); }

.achievement-badge__sub {
  font-size: 16rpx;
  color: rgba(255,255,255,0.28);
  font-family: monospace;
  letter-spacing: 1rpx;
}

.achievement-badge--on .achievement-badge__sub { color: var(--primary); opacity: 0.7; }


/* ===== 7. ARCHIVES ===== */
.term-card--archives { padding: 24rpx; }

.archive-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(255,255,255,0.04);
}

.archive-row--last { border-bottom: none; }

.archive-row:active { background: rgba(255,255,255,0.02); }

.archive-row__icon {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.archive-row__content { flex: 1; min-width: 0; }

.archive-row__title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.92);
}

.archive-row__desc {
  display: block;
  font-size: 20rpx;
  color: rgba(255,255,255,0.38);
  margin-top: 2rpx;
}


/* ===== 8. SYSTEM CONTROL ===== */
.term-card--system { padding: 24rpx; }

.sys-link {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(255,255,255,0.04);
}

.sys-link--last { border-bottom: none; }
.sys-link:active { opacity: 0.6; }

.sys-link__zh {
  font-size: 28rpx;
  font-weight: 500;
  color: rgba(255,255,255,0.78);
}

.sys-link__en {
  font-size: 18rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
  margin-left: 12rpx;
  opacity: 0.6;
}

.sys-link .svg-icon--arrow { margin-left: auto; }


/* ===== 9. TERMINATE SESSION ===== */
.terminate-btn {
  margin-top: 20rpx;
  padding: 24rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  border: 1rpx solid rgba(255,77,79,0.24);
  border-radius: var(--card-radius);
  background: transparent;
}

.terminate-btn:active {
  background: rgba(255,77,79,0.04);
}

.terminate-btn__en {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--danger);
  letter-spacing: 3rpx;
  opacity: 0.8;
}

.terminate-btn__zh {
  font-size: 20rpx;
  color: var(--danger);
  opacity: 0.5;
  letter-spacing: 2rpx;
}


/* ===== 动效 ===== */
@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.4; }
}

@keyframes breathe {
  0%, 100% { opacity: 1; box-shadow: 0 0 8rpx rgba(54,255,116,0.5); }
  50% { opacity: 0.6; box-shadow: 0 0 4rpx rgba(54,255,116,0.3); }
}

.reduce-motion .identity__saving { animation: none !important; }
.reduce-motion .status-bar__dot--online { animation: none !important; }
.reduce-motion .level__node--current .level__node-dot { animation: none !important; }
.reduce-motion .terminal__glow,
.reduce-motion .identity__avatar-ring,
.reduce-motion .level__bar-fill,
.reduce-motion .term-card {
  transition: none !important;
  animation: none !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/profile/profile.wxss
git commit -m "feat: profile.wxss 身份终端新配色全量重写"
```

---

## Task 10: Verification

- [ ] **Step 1: Verify backend compiles**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 2: Start backend and test endpoint**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run
```

Then test (with valid JWT):
```bash
curl -s http://localhost:18080/api/user/identity-level -H "Authorization: Bearer <token>" | python3 -m json.tool
```

Expected response shape:
```json
{
  "code": 200,
  "data": {
    "level": 1,
    "title": "新人观察员",
    "exp": 0,
    "nextLevelExp": 100,
    "progress": 0,
    "stability": null
  }
}
```

- [ ] **Step 3: Verify frontend renders**

Open WeChat DevTools, navigate to "我的" tab. Verify:
- New color scheme (#05070A background, #00AFFF primary)
- 9 modules render in order
- Level badge shows on player profile
- Data matrix shows 4-cell grid
- Identity level shows progress bar
- Archives show as list rows (not grid)
- System control shows Chinese + English labels
- Terminate session button is red outline style
