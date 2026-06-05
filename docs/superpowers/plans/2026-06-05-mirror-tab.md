# Mirror Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Mirror (镜像) tab for Smart Record WeChat mini-program — a cyberpunk-style multi-dimensional testing terminal with MBTI personality calibration, taibu divination tools, daily field readings, and result archives.

**Architecture:** New `mirror` module in existing Java 21 + Spring Boot backend. MirrorToolService wraps existing TaibuService (GraalVM JS). MirrorInterpretService calls MiMo LLM with fallback pool. Frontend replaces gallery tab with 4 new pages + 7 components. Dark glassmorphism UI.

**Tech Stack:** Java 21, Spring Boot 3.2.5, MyBatis-Plus, MySQL 8.0, Redis 7, GraalVM Polyglot, Hutool HTTP, WeChat Mini Program (WXML/WXSS/JS)

**Spec:** `docs/superpowers/specs/2026-06-05-mirror-tab-design.md`

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `backend/src/main/resources/sql/mirror_tables.sql` | DDL for 4 tables |
| `backend/.../entity/UserMirrorProfile.java` | MBTI profile entity |
| `backend/.../entity/MirrorBirthProfile.java` | Birth profile entity |
| `backend/.../entity/MirrorReport.java` | Report entity |
| `backend/.../entity/MirrorDailyField.java` | Daily field entity |
| `backend/.../mapper/UserMirrorProfileMapper.java` | MBTI profile mapper |
| `backend/.../mapper/MirrorBirthProfileMapper.java` | Birth profile mapper |
| `backend/.../mapper/MirrorReportMapper.java` | Report mapper |
| `backend/.../mapper/MirrorDailyFieldMapper.java` | Daily field mapper |
| `backend/.../enums/MirrorToolType.java` | 15 tool types with metadata |
| `backend/.../enums/MbtiSource.java` | test / direct |
| `backend/.../enums/MirrorReportSource.java` | taibu / mimo / fallback |
| `backend/.../dto/mirror/MirrorDashboardResp.java` | Dashboard aggregate response |
| `backend/.../dto/mirror/MirrorToolRunReq.java` | Tool run request |
| `backend/.../dto/mirror/MirrorToolRunResp.java` | Tool run response |
| `backend/.../dto/mirror/MbtiTestReq.java` | MBTI test submit |
| `backend/.../dto/mirror/MbtiDirectReq.java` | MBTI direct input |
| `backend/.../dto/mirror/MirrorReportResp.java` | Report detail response |
| `backend/.../dto/mirror/MirrorArchiveResp.java` | Archive list item |
| `backend/.../dto/mirror/BirthProfileReq.java` | Birth profile save |
| `backend/.../dto/mirror/DailyFieldResp.java` | Daily field response |
| `backend/.../dto/mirror/TaibuRunResult.java` | Taibu execution result |
| `backend/.../dto/mirror/MirrorInterpretation.java` | LLM interpretation result |
| `backend/.../service/MirrorService.java` | Dashboard aggregation interface |
| `backend/.../service/MirrorToolService.java` | Tool execution interface |
| `backend/.../service/MirrorInterpretService.java` | LLM interpretation interface |
| `backend/.../service/MirrorReportService.java` | Report CRUD interface |
| `backend/.../service/MirrorProfileService.java` | Profile management interface |
| `backend/.../service/impl/MirrorServiceImpl.java` | Dashboard aggregation impl |
| `backend/.../service/impl/MirrorToolServiceImpl.java` | Wraps TaibuService |
| `backend/.../service/impl/MirrorInterpretServiceImpl.java` | MiMo LLM + fallback |
| `backend/.../service/impl/MirrorReportServiceImpl.java` | Report CRUD impl |
| `backend/.../service/impl/MirrorProfileServiceImpl.java` | Profile management impl |
| `backend/.../service/impl/MirrorContentGuard.java` | Content safety filter |
| `backend/.../service/impl/MirrorInterpretFallbackPool.java` | Fallback interpretation pool |
| `backend/.../service/impl/MbtiCalculator.java` | MBTI 20-question scoring |
| `backend/.../controller/MirrorController.java` | 8 REST endpoints |

### Frontend — New Files
| File | Responsibility |
|------|----------------|
| `miniprogram/pages/mirror/index.*` | Mirror home page (tab) |
| `miniprogram/pages/mirror/tool/index.*` | Tool input page |
| `miniprogram/pages/mirror/report/index.*` | Report detail page |
| `miniprogram/pages/mirror/archive/index.*` | Archive page |
| `miniprogram/components/mirror-personality-card/*` | MBTI card component |
| `miniprogram/components/mirror-today-field/*` | Daily field card |
| `miniprogram/components/mirror-tool-card/*` | Tool card component |
| `miniprogram/components/mbti-swipe-test/*` | 20-question swipe test |
| `miniprogram/components/mbti-picker-modal/*` | MBTI direct input modal |
| `miniprogram/utils/mirror-api.js` | API wrapper |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `miniprogram/app.json` | Replace gallery tab with mirror |
| `miniprogram/app.wxss` | Add mirror-specific utility classes |

---

## Phase 1: Foundation (Database + Entities + Enums + Controller Skeleton)

### Task 1.1: SQL DDL

**Files:**
- Create: `backend/src/main/resources/sql/mirror_tables.sql`

- [ ] Create DDL file with 4 tables, all using BIGINT PKs (no auto-increment), JSON columns, proper indexes, and timestamps.

```sql
-- user_mirror_profile: MBTI 博弈人格校准
CREATE TABLE IF NOT EXISTS user_mirror_profile (
    user_id       BIGINT       PRIMARY KEY COMMENT '用户ID',
    mbti_type     VARCHAR(4)   DEFAULT NULL COMMENT 'MBTI类型(如INTJ)',
    mbti_source   VARCHAR(16)  DEFAULT NULL COMMENT '来源: test/direct',
    mbti_confidence DECIMAL(5,2) DEFAULT NULL COMMENT '置信度 0-100',
    mbti_test_version VARCHAR(32) DEFAULT NULL COMMENT '测试版本',
    mbti_answers_json JSON      DEFAULT NULL COMMENT '测试原始答案',
    mbti_title    VARCHAR(64)  DEFAULT NULL COMMENT '中文称号',
    calibrated_at DATETIME     DEFAULT NULL COMMENT '校准时间',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MBTI博弈人格校准';

-- mirror_birth_profile: 出生档案
CREATE TABLE IF NOT EXISTS mirror_birth_profile (
    user_id       BIGINT       PRIMARY KEY COMMENT '用户ID',
    calendar_type VARCHAR(16)  DEFAULT 'solar' COMMENT '历法: solar/lunar',
    birth_date    DATE         DEFAULT NULL COMMENT '出生日期',
    birth_time    VARCHAR(16)  DEFAULT NULL COMMENT '出生时间(HH:mm)',
    birth_place   VARCHAR(128) DEFAULT NULL COMMENT '出生地',
    timezone      VARCHAR(64)  DEFAULT 'Asia/Shanghai' COMMENT '时区',
    gender        VARCHAR(16)  DEFAULT NULL COMMENT '性别',
    extra_json    JSON         DEFAULT NULL COMMENT '扩展字段',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出生档案';

-- mirror_report: 测试结果
CREATE TABLE IF NOT EXISTS mirror_report (
    id                BIGINT       PRIMARY KEY COMMENT '雪花ID',
    user_id           BIGINT       NOT NULL COMMENT '用户ID',
    tool_type         VARCHAR(64)  NOT NULL COMMENT '工具类型code',
    question          VARCHAR(512) DEFAULT NULL COMMENT '用户问题',
    title             VARCHAR(128) DEFAULT NULL COMMENT '结果标题',
    raw_result        JSON         DEFAULT NULL COMMENT 'taibu原始返回',
    normalized_result JSON         DEFAULT NULL COMMENT '标准化字段',
    mbti_snapshot     JSON         DEFAULT NULL COMMENT '当时MBTI快照',
    interpretation    JSON         DEFAULT NULL COMMENT '解释结果',
    summary           TEXT         DEFAULT NULL COMMENT '摘要',
    suggestions       JSON         DEFAULT NULL COMMENT '建议列表',
    warnings          JSON         DEFAULT NULL COMMENT '预警列表',
    theme_color       VARCHAR(16)  DEFAULT '#0A84FF' COMMENT '主题色',
    tag               VARCHAR(32)  DEFAULT NULL COMMENT '状态标签',
    source            VARCHAR(32)  DEFAULT 'taibu' COMMENT '来源: taibu/mimo/fallback',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_user_tool (user_id, tool_type),
    INDEX idx_tool_created (tool_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='镜像测试结果';

-- mirror_daily_field: 每日场域缓存
CREATE TABLE IF NOT EXISTS mirror_daily_field (
    id              BIGINT       PRIMARY KEY COMMENT '雪花ID',
    user_id         BIGINT       NOT NULL COMMENT '用户ID',
    field_date      DATE         NOT NULL COMMENT '日期',
    almanac_result  JSON         DEFAULT NULL COMMENT '黄历结果',
    taiyi_result    JSON         DEFAULT NULL COMMENT '太乙结果',
    summary         VARCHAR(512) DEFAULT NULL COMMENT '摘要',
    tag             VARCHAR(32)  DEFAULT NULL COMMENT '状态标签',
    theme_color     VARCHAR(16)  DEFAULT '#0A84FF' COMMENT '主题色',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, field_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日场域缓存';
```

- [ ] Run DDL against local MySQL: `docker-compose exec mysql mysql -u root -proot smartrecord -e "source /tmp/mirror_tables.sql"` or use MySQL client directly.

### Task 1.2: Enum Classes

**Files:**
- Create: `backend/src/main/java/com/smartrecord/enums/MirrorToolType.java`
- Create: `backend/src/main/java/com/smartrecord/enums/MbtiSource.java`
- Create: `backend/src/main/java/com/smartrecord/enums/MirrorReportSource.java`

- [ ] **MirrorToolType** — 15 tools with metadata fields:

```java
package com.smartrecord.enums;

import com.smartrecord.common.BizException;
import lombok.Getter;

@Getter
public enum MirrorToolType {

    // TODAY
    ALMANAC("almanac", "今日黄历", "TODAY", false, false, "今日宜忌与场域概览"),
    TAIYI("taiyi", "太乙九星", "TODAY", false, false, "太乙九星时空推演"),

    // QUICK
    TAROT("tarot", "塔罗抽牌", "QUICK", false, true, "探索潜意识与短期选择"),
    MEIHUA("meihua", "梅花易数", "QUICK", false, true, "随机事件与局势判断"),
    XIAOLIUREN("xiaoliuren", "小六壬", "QUICK", false, true, "今日行动与快速判断"),
    LIUYAO("liuyao", "六爻", "QUICK", false, true, "明确问题与趋势判断"),
    QIMEN("qimen", "奇门遁甲", "QUICK", false, true, "谈判合作与时机推演"),

    // PROFILE
    BAZI("bazi", "八字排盘", "PROFILE", true, false, "长期结构画像"),
    ZIWEI("ziwei", "紫微斗数", "PROFILE", true, false, "命盘宫位分析"),
    ASTROLOGY("astrology", "西方占星", "PROFILE", true, false, "三巨头与流运重点"),

    // ADVANCED
    BAZI_DAYUN("bazi_dayun", "八字大运", "ADVANCED", true, false, "十年周期与流年变化"),
    BAZI_PILLARS_RESOLVE("bazi_pillars_resolve", "八字反查", "ADVANCED", true, false, "天干地支反向查询"),
    ZIWEI_HOROSCOPE("ziwei_horoscope", "紫微运限", "ADVANCED", true, false, "大限小限与流年"),
    ZIWEI_FLYING_STAR("ziwei_flying_star", "紫微飞星", "ADVANCED", true, false, "四化落宫与三方四正"),
    DALIUREN("daliuren", "大六壬", "ADVANCED", true, false, "四课三传高级占测");

    private final String code;
    private final String displayName;
    private final String category;
    private final boolean requiresBirthProfile;
    private final boolean requiresQuestion;
    private final String description;

    MirrorToolType(String code, String displayName, String category,
                   boolean requiresBirthProfile, boolean requiresQuestion, String description) {
        this.code = code;
        this.displayName = displayName;
        this.category = category;
        this.requiresBirthProfile = requiresBirthProfile;
        this.requiresQuestion = requiresQuestion;
        this.description = description;
    }

    public static MirrorToolType fromCode(String code) {
        for (MirrorToolType t : values()) {
            if (t.code.equals(code)) return t;
        }
        throw new BizException("未知工具类型: " + code);
    }
}
```

- [ ] **MbtiSource**:

```java
package com.smartrecord.enums;

public enum MbtiSource {
    TEST, DIRECT
}
```

- [ ] **MirrorReportSource**:

```java
package com.smartrecord.enums;

public enum MirrorReportSource {
    TAIBU, MIMO, FALLBACK
}
```

### Task 1.3: Entity Classes

**Files:**
- Create: `backend/src/main/java/com/smartrecord/entity/UserMirrorProfile.java`
- Create: `backend/src/main/java/com/smartrecord/entity/MirrorBirthProfile.java`
- Create: `backend/src/main/java/com/smartrecord/entity/MirrorReport.java`
- Create: `backend/src/main/java/com/smartrecord/entity/MirrorDailyField.java`

- [ ] **UserMirrorProfile** — uses `@TableId(type = IdType.INPUT)` since PK is user_id (not generated):

```java
package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "user_mirror_profile", autoResultMap = true)
public class UserMirrorProfile {

    @TableId(type = IdType.INPUT)
    private Long userId;

    private String mbtiType;
    private String mbtiSource;
    private java.math.BigDecimal mbtiConfidence;
    private String mbtiTestVersion;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Object> mbtiAnswersJson;

    private String mbtiTitle;
    private LocalDateTime calibratedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
```

- [ ] **MirrorBirthProfile**:

```java
package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "mirror_birth_profile", autoResultMap = true)
public class MirrorBirthProfile {

    @TableId(type = IdType.INPUT)
    private Long userId;

    private String calendarType;
    private LocalDate birthDate;
    private String birthTime;
    private String birthPlace;
    private String timezone;
    private String gender;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> extraJson;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
```

- [ ] **MirrorReport**:

```java
package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "mirror_report", autoResultMap = true)
public class MirrorReport {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;
    private String toolType;
    private String question;
    private String title;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> rawResult;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> normalizedResult;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> mbtiSnapshot;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> interpretation;

    private String summary;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> suggestions;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> warnings;

    private String themeColor;
    private String tag;
    private String source;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
```

- [ ] **MirrorDailyField**:

```java
package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "mirror_daily_field", autoResultMap = true)
public class MirrorDailyField {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;
    private LocalDate fieldDate;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> almanacResult;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> taiyiResult;

    private String summary;
    private String tag;
    private String themeColor;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
```

### Task 1.4: Mapper Interfaces

**Files:**
- Create: `backend/src/main/java/com/smartrecord/mapper/UserMirrorProfileMapper.java`
- Create: `backend/src/main/java/com/smartrecord/mapper/MirrorBirthProfileMapper.java`
- Create: `backend/src/main/java/com/smartrecord/mapper/MirrorReportMapper.java`
- Create: `backend/src/main/java/com/smartrecord/mapper/MirrorDailyFieldMapper.java`

- [ ] All four are empty interfaces extending `BaseMapper<T>`, following existing pattern:

```java
package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.UserMirrorProfile;

public interface UserMirrorProfileMapper extends BaseMapper<UserMirrorProfile> {
}
```

(Same pattern for MirrorBirthProfileMapper, MirrorReportMapper, MirrorDailyFieldMapper)

### Task 1.5: DTO Classes

**Files:**
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MirrorDashboardResp.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MirrorToolRunReq.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MirrorToolRunResp.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MbtiTestReq.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MbtiDirectReq.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MirrorReportResp.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MirrorArchiveItem.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/BirthProfileReq.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/DailyFieldResp.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/TaibuRunResult.java`
- Create: `backend/src/main/java/com/smartrecord/dto/mirror/MirrorInterpretation.java`

- [ ] **MirrorDashboardResp** — aggregate response for dashboard:

```java
package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import java.util.List;

@Data
@Builder
@Schema(description = "镜像首页聚合响应")
public class MirrorDashboardResp {

    @Schema(description = "MBTI人格信息")
    private ProfileInfo profile;

    @Schema(description = "今日场域")
    private DailyFieldInfo todayField;

    @Schema(description = "快速占测工具列表")
    private List<ToolItem> quickTools;

    @Schema(description = "命盘画像工具列表")
    private List<ToolItem> profileTools;

    @Schema(description = "高级推演工具列表")
    private List<ToolItem> advancedTools;

    @Schema(description = "最近测试结果")
    private List<RecentReport> recentReports;

    @Schema(description = "出生档案信息")
    private BirthProfileInfo birthProfile;

    @Data
    @Builder
    @Schema(description = "MBTI人格信息")
    public static class ProfileInfo {
        private boolean calibrated;
        private String mbtiType;
        private String mbtiTitle;
        private java.math.BigDecimal confidence;
        private String mbtiSource;
        private String calibratedAt;
    }

    @Data
    @Builder
    @Schema(description = "今日场域信息")
    public static class DailyFieldInfo {
        private String tag;
        private String summary;
        private String themeColor;
        private String date;
    }

    @Data
    @Builder
    @Schema(description = "工具项")
    public static class ToolItem {
        private String key;
        private String code;
        private String name;
        private String desc;
        private String category;
        private boolean locked;
        private String lockReason;
        private boolean todayUsed;
    }

    @Data
    @Builder
    @Schema(description = "最近测试结果")
    public static class RecentReport {
        private Long id;
        private String toolType;
        private String toolName;
        private String title;
        private String tag;
        private String createdAt;
        private String timeText;
    }

    @Data
    @Builder
    @Schema(description = "出生档案信息")
    public static class BirthProfileInfo {
        private boolean exists;
        private String briefText;
    }
}
```

- [ ] **MirrorToolRunReq**:

```java
package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.Map;

@Data
@Schema(description = "镜像工具运行请求")
public class MirrorToolRunReq {

    @NotBlank(message = "工具类型不能为空")
    @Schema(description = "工具类型code", example = "meihua")
    private String tool;

    @Schema(description = "用户问题", example = "今晚适合主动进攻吗")
    private String question;

    @Schema(description = "工具参数")
    private Map<String, Object> params;
}
```

- [ ] **MirrorToolRunResp**:

```java
package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import java.util.List;
import java.util.Map;

@Data
@Builder
@Schema(description = "镜像工具运行响应")
public class MirrorToolRunResp {
    private Long reportId;
    private String tool;
    private String toolName;
    private String title;
    private String tag;
    private String themeColor;
    private String question;
    private Map<String, Object> normalizedResult;
    private MirrorInterpretation interpretation;
    private String source;
}
```

- [ ] **MbtiTestReq**:

```java
package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
@Schema(description = "MBTI测试提交请求")
public class MbtiTestReq {

    @NotBlank
    @Schema(description = "测试版本", example = "v1")
    private String testVersion;

    @NotNull
    @Schema(description = "答案列表(20题)")
    private List<Answer> answers;

    @Data
    @Schema(description = "单题答案")
    public static class Answer {
        @NotBlank
        private String questionId;
        @NotBlank
        private String dimension;   // E_I, S_N, T_F, J_P
        private int score;           // 1=像我, -1=不像我, 0=不确定
    }
}
```

- [ ] **MbtiDirectReq**:

```java
package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "MBTI直接输入请求")
public class MbtiDirectReq {

    @NotBlank
    @Schema(description = "MBTI类型", example = "INTJ")
    private String mbtiType;
}
```

- [ ] **MirrorInterpretation**:

```java
package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import java.util.List;

@Data
@Builder
@Schema(description = "镜像解释结果")
public class MirrorInterpretation {
    private String title;
    private String tag;
    private String themeColor;
    private String confidence;  // LOW / MEDIUM / HIGH
    private String summary;
    private List<String> suggestions;
    private List<String> warnings;
}
```

- [ ] **TaibuRunResult**:

```java
package com.smartrecord.dto.mirror;

import lombok.Data;
import lombok.Builder;
import java.util.Map;

@Data
@Builder
public class TaibuRunResult {
    private boolean success;
    private Map<String, Object> rawResult;
    private Map<String, Object> normalizedResult;
    private String error;
}
```

- [ ] **MirrorReportResp** — full report detail (reuse fields from MirrorReport entity + interpretation).

- [ ] **MirrorArchiveItem** — lightweight item for archive list.

- [ ] **BirthProfileReq** — calendarType, birthDate, birthTime, birthPlace, timezone, gender.

- [ ] **DailyFieldResp** — tag, summary, themeColor, date, actions (almanac/taiyi).

### Task 1.6: Controller Skeleton + Service Interfaces

**Files:**
- Create: `backend/src/main/java/com/smartrecord/controller/MirrorController.java`
- Create: `backend/src/main/java/com/smartrecord/service/MirrorService.java`
- Create: `backend/src/main/java/com/smartrecord/service/MirrorToolService.java`
- Create: `backend/src/main/java/com/smartrecord/service/MirrorInterpretService.java`
- Create: `backend/src/main/java/com/smartrecord/service/MirrorReportService.java`
- Create: `backend/src/main/java/com/smartrecord/service/MirrorProfileService.java`

- [ ] **MirrorController** — all 8 endpoints, delegating to service interfaces:

```java
package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.mirror.*;
import com.smartrecord.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "镜像模块", description = "MBTI人格校准 + taibu多维测试终端")
@RestController
@RequestMapping("/mirror")
@RequiredArgsConstructor
public class MirrorController {

    private final MirrorService mirrorService;
    private final MirrorProfileService mirrorProfileService;
    private final MirrorToolService mirrorToolService;
    private final MirrorReportService mirrorReportService;

    @Operation(summary = "首页聚合数据")
    @GetMapping("/dashboard")
    public Result<MirrorDashboardResp> dashboard(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorService.getDashboard(userId));
    }

    @Operation(summary = "MBTI 20题测试")
    @PostMapping("/mbti/test")
    public Result<MirrorDashboardResp.ProfileInfo> mbtiTest(
            HttpServletRequest request, @Valid @RequestBody MbtiTestReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.submitMbtiTest(userId, req));
    }

    @Operation(summary = "MBTI直接输入")
    @PostMapping("/mbti/direct")
    public Result<MirrorDashboardResp.ProfileInfo> mbtiDirect(
            HttpServletRequest request, @Valid @RequestBody MbtiDirectReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.submitMbtiDirect(userId, req.getMbtiType()));
    }

    @Operation(summary = "运行工具")
    @PostMapping("/tool/run")
    public Result<MirrorToolRunResp> runTool(
            HttpServletRequest request, @Valid @RequestBody MirrorToolRunReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorToolService.runTool(userId, req));
    }

    @Operation(summary = "获取测试结果详情")
    @GetMapping("/report/{id}")
    public Result<MirrorReportResp> getReport(
            HttpServletRequest request, @PathVariable Long id) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorReportService.getReport(userId, id));
    }

    @Operation(summary = "获取测试档案")
    @GetMapping("/archive")
    public Result<?> getArchive(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String category) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorReportService.getArchive(userId, page, pageSize, category));
    }

    @Operation(summary = "保存出生档案")
    @PostMapping("/birth-profile")
    public Result<Void> saveBirthProfile(
            HttpServletRequest request, @RequestBody BirthProfileReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        mirrorProfileService.saveBirthProfile(userId, req);
        return Result.ok();
    }

    @Operation(summary = "获取出生档案")
    @GetMapping("/birth-profile")
    public Result<BirthProfileReq> getBirthProfile(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.getBirthProfile(userId));
    }
}
```

- [ ] Service interfaces — each with method signatures matching controller calls. Empty method bodies throw `UnsupportedOperationException` for now.

### Task 1.7: Commit Phase 1

- [ ] `git add` all new files and commit:

```bash
git add backend/src/main/resources/sql/ backend/src/main/java/com/smartrecord/enums/ backend/src/main/java/com/smartrecord/entity/UserMirrorProfile.java backend/src/main/java/com/smartrecord/entity/MirrorBirthProfile.java backend/src/main/java/com/smartrecord/entity/MirrorReport.java backend/src/main/java/com/smartrecord/entity/MirrorDailyField.java backend/src/main/java/com/smartrecord/mapper/UserMirrorProfileMapper.java backend/src/main/java/com/smartrecord/mapper/MirrorBirthProfileMapper.java backend/src/main/java/com/smartrecord/mapper/MirrorReportMapper.java backend/src/main/java/com/smartrecord/mapper/MirrorDailyFieldMapper.java backend/src/main/java/com/smartrecord/dto/mirror/ backend/src/main/java/com/smartrecord/controller/MirrorController.java backend/src/main/java/com/smartrecord/service/MirrorService.java backend/src/main/java/com/smartrecord/service/MirrorToolService.java backend/src/main/java/com/smartrecord/service/MirrorInterpretService.java backend/src/main/java/com/smartrecord/service/MirrorReportService.java backend/src/main/java/com/smartrecord/service/MirrorProfileService.java

git commit -m "feat(mirror): 基础结构 - 数据表、Entity、Mapper、Enum、DTO、Controller骨架"
```

---

## Phase 2: Frontend Home Page

### Task 2.1: TabBar Replacement + mirror-api.js

**Files:**
- Modify: `miniprogram/app.json`
- Create: `miniprogram/utils/mirror-api.js`

- [ ] In `app.json`, replace the gallery entry in pages array and tabBar:

pages array: replace `"pages/gallery/gallery"` with `"pages/mirror/index"`, add subpages:
```json
"pages": [
    "pages/login/login",
    "pages/room/room",
    "pages/fortune/fortune",
    "pages/mirror/index",
    "pages/mirror/tool/index",
    "pages/mirror/report/index",
    "pages/mirror/archive/index",
    "pages/profile/profile",
    "pages/voice-select/voice-select",
    "pages/settle/settle",
    "pages/history/history"
]
```

tabBar list: replace gallery entry:
```json
{
    "pagePath": "pages/mirror/index",
    "text": "镜像",
    "iconPath": "images/tab-gallery.png",
    "selectedIconPath": "images/tab-gallery-active.png"
}
```

- [ ] Create `mirror-api.js`:

```javascript
const { get, post } = require('./request');

module.exports = {
  getMirrorDashboard: () => get('/mirror/dashboard'),
  submitMbtiTest: (data) => post('/mirror/mbti/test', data),
  submitMbtiDirect: (data) => post('/mirror/mbti/direct', data),
  runMirrorTool: (data) => post('/mirror/tool/run', data),
  getMirrorReport: (id) => get(`/mirror/report/${id}`),
  getMirrorArchive: (params) => get('/mirror/archive', params),
  saveBirthProfile: (data) => post('/mirror/birth-profile', data),
  getBirthProfile: () => get('/mirror/birth-profile'),
};
```

### Task 2.2: Mirror Home Page Skeleton

**Files:**
- Create: `miniprogram/pages/mirror/index.json`
- Create: `miniprogram/pages/mirror/index.wxml`
- Create: `miniprogram/pages/mirror/index.wxss`
- Create: `miniprogram/pages/mirror/index.js`

- [ ] **index.json** — page config with component declarations:

```json
{
    "navigationBarTitleText": "镜像",
    "navigationBarBackgroundColor": "#0a0a0a",
    "navigationBarTextStyle": "white",
    "usingComponents": {
        "mirror-personality-card": "/components/mirror-personality-card/mirror-personality-card",
        "mirror-today-field": "/components/mirror-today-field/mirror-today-field",
        "mirror-tool-card": "/components/mirror-tool-card/mirror-tool-card"
    }
}
```

- [ ] **index.js** — Page with data structure matching spec, loadDashboard(), event handlers:

```javascript
const api = require('../../utils/mirror-api');
const app = getApp();

Page({
  data: {
    loading: true,
    reduceMotion: false,
    profile: { calibrated: false, mbtiType: '', mbtiTitle: '', confidence: 0, mbtiSource: '', calibratedAt: '' },
    todayField: { tag: '', summary: '', themeColor: '#0A84FF', date: '' },
    quickTools: [],
    profileTools: [],
    advancedTools: [],
    recentReports: [],
    birthProfile: { exists: false, briefText: '' },
    showSwipeTest: false,
    showMbtiPicker: false,
  },

  onLoad() {
    this.setData({ reduceMotion: !app.globalData.animationEnabled });
    this.loadDashboard();
  },

  onShow() {
    if (this.data.needRefresh) {
      this.loadDashboard();
      this.setData({ needRefresh: false });
    }
  },

  onPullDownRefresh() {
    this.loadDashboard().then(() => wx.stopPullDownRefresh());
  },

  async loadDashboard() {
    try {
      const data = await api.getMirrorDashboard();
      this.setData({
        loading: false,
        profile: data.profile || this.data.profile,
        todayField: data.todayField || this.data.todayField,
        quickTools: data.quickTools || [],
        profileTools: data.profileTools || [],
        advancedTools: data.advancedTools || [],
        recentReports: data.recentReports || [],
        birthProfile: data.birthProfile || this.data.birthProfile,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  startMbtiTest() { this.setData({ showSwipeTest: true }); },
  closeMbtiTest() { this.setData({ showSwipeTest: false }); },
  openMbtiPicker() { this.setData({ showMbtiPicker: true }); },
  closeMbtiPicker() { this.setData({ showMbtiPicker: false }); },

  async handleMbtiComplete(e) {
    const { testVersion, answers } = e.detail;
    try {
      const profile = await api.submitMbtiTest({ testVersion, answers });
      this.setData({ showSwipeTest: false, profile, needRefresh: true });
      this.loadDashboard();
      wx.showToast({ title: '校准完成', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  async handleMbtiDirectInput(e) {
    const { mbtiType } = e.detail;
    try {
      const profile = await api.submitMbtiDirect({ mbtiType });
      this.setData({ showMbtiPicker: false, profile, needRefresh: true });
      this.loadDashboard();
      wx.showToast({ title: '设置成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  openTool(e) {
    const { code, locked, lockreason } = e.currentTarget.dataset;
    if (locked) {
      wx.showToast({ title: lockreason || '暂不可用', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/mirror/tool/index?tool=${code}` });
  },

  openArchive() {
    wx.navigateTo({ url: '/pages/mirror/archive/index' });
  },

  openReport(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/mirror/report/index?id=${id}` });
  },
});
```

- [ ] **index.wxml** — page structure with all sections. Full code follows the module order: header, personality-card, today-field, quick tools grid, profile tools grid, advanced tools list, recent reports, bottom disclaimer. Skeleton shown when loading=true.

- [ ] **index.wxss** — page styles using existing CSS variable system, glass cards, dark theme. Classes: `.mirror-page`, `.mirror-header`, `.section`, `.section-head`, `.tool-grid`, `.advanced-list`, `.recent-list`, `.empty-state`, `.skeleton`, `.disclaimer`, `.reduce-motion`.

### Task 2.3: mirror-personality-card Component

**Files:**
- Create: `miniprogram/components/mirror-personality-card/mirror-personality-card.wxml`
- Create: `miniprogram/components/mirror-personality-card/mirror-personality-card.wxss`
- Create: `miniprogram/components/mirror-personality-card/mirror-personality-card.js`
- Create: `miniprogram/components/mirror-personality-card/mirror-personality-card.json`

- [ ] Component with two states: uncalibrated (shows prompt + two buttons) and calibrated (shows MBTI type, title, confidence, source, two buttons). Events: `bind:start-test`, `bind:direct-input`.

### Task 2.4: mirror-today-field Component

**Files:**
- Create: `miniprogram/components/mirror-today-field/mirror-today-field.wxml`
- Create: `miniprogram/components/mirror-today-field/mirror-today-field.wxss`
- Create: `miniprogram/components/mirror-today-field/mirror-today-field.js`
- Create: `miniprogram/components/mirror-today-field/mirror-today-field.json`

- [ ] Shows today's field tag, summary, and two action buttons (almanac/taiyi). Event: `bind:open-tool`.

### Task 2.5: mirror-tool-card Component

**Files:**
- Create: `miniprogram/components/mirror-tool-card/mirror-tool-card.wxml`
- Create: `miniprogram/components/mirror-tool-card/mirror-tool-card.wxss`
- Create: `miniprogram/components/mirror-tool-card/mirror-tool-card.js`
- Create: `miniprogram/components/mirror-tool-card/mirror-tool-card.json`

- [ ] Simple card showing tool name, description. Supports locked state (grayed, lock icon + reason) and todayUsed state. Uses CSS line icon, no emoji.

### Task 2.6: Commit Phase 2

```bash
git add miniprogram/app.json miniprogram/utils/mirror-api.js miniprogram/pages/mirror/ miniprogram/components/mirror-personality-card/ miniprogram/components/mirror-today-field/ miniprogram/components/mirror-tool-card/
git commit -m "feat(mirror): 前端首页 - Tab替换、镜像页面、人格卡、场域卡、工具卡"
```

---

## Phase 3: MBTI Backend + Frontend

### Task 3.1: MBTI Calculator

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MbtiCalculator.java`

- [ ] Static utility class. Takes `List<MbtiTestReq.Answer>`, computes MBTI type from 4 dimensions. Each dimension: sum positive scores vs negative, pick higher. Returns type string + confidence percentage.

```java
package com.smartrecord.service.impl;

import com.smartrecord.dto.mirror.MbtiTestReq;
import java.util.*;

public class MbtiCalculator {

    private static final Map<String, String> TITLE_MAP = Map.ofEntries(
        Map.entry("INTJ", "冷静型控场者"), Map.entry("INTP", "模型型分析者"),
        Map.entry("ENTJ", "压迫型指挥者"), Map.entry("ENTP", "扰动型试探者"),
        Map.entry("INFJ", "远读型观察者"), Map.entry("INFP", "直觉型守序者"),
        Map.entry("ENFJ", "节奏型组织者"), Map.entry("ENFP", "机会型游走者"),
        Map.entry("ISTJ", "纪律型执行者"), Map.entry("ISFJ", "防守型稳定者"),
        Map.entry("ESTJ", "规则型压制者"), Map.entry("ESFJ", "协同型支援者"),
        Map.entry("ISTP", "冷启动猎手"),   Map.entry("ISFP", "低频型感知者"),
        Map.entry("ESTP", "高压型突击者"), Map.entry("ESFP", "现场型爆发者")
    );

    private static final List<String> ALL_TYPES = List.of(
        "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
        "ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"
    );

    public static Result calculate(List<MbtiTestReq.Answer> answers) {
        Map<String, int[]> dims = new LinkedHashMap<>();
        dims.put("E_I", new int[]{0, 0}); // [positive, negative]
        dims.put("S_N", new int[]{0, 0});
        dims.put("T_F", new int[]{0, 0});
        dims.put("J_P", new int[]{0, 0});

        for (var a : answers) {
            int[] d = dims.get(a.getDimension());
            if (d == null) continue;
            if (a.getScore() > 0) d[0]++;
            else if (a.getScore() < 0) d[1]++;
        }

        StringBuilder type = new StringBuilder();
        double totalConfidence = 0;
        String[][] pairs = {{"E","I"},{"S","N"},{"T","F"},{"J","P"}};
        int i = 0;
        for (var entry : dims.entrySet()) {
            int[] d = entry.getValue();
            int total = d[0] + d[1];
            if (total == 0) {
                type.append(pairs[i][0]);
                totalConfidence += 50;
            } else if (d[0] >= d[1]) {
                type.append(pairs[i][0]);
                totalConfidence += (double) d[0] / total * 100;
            } else {
                type.append(pairs[i][1]);
                totalConfidence += (double) d[1] / total * 100;
            }
            i++;
        }

        String mbtiType = type.toString();
        return new Result(mbtiType, TITLE_MAP.getOrDefault(mbtiType, "未知型"), totalConfidence / 4);
    }

    public static boolean isValidType(String type) {
        return ALL_TYPES.contains(type);
    }

    public static String getTitle(String type) {
        return TITLE_MAP.getOrDefault(type, "未知型");
    }

    public record Result(String type, String title, double confidence) {}
}
```

### Task 3.2: MirrorProfileServiceImpl

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorProfileServiceImpl.java`

- [ ] Implements `MirrorProfileService`. Methods:
  - `submitMbtiTest(userId, req)` — validate 20 answers, call MbtiCalculator, save to user_mirror_profile, clear Redis caches, return ProfileInfo
  - `submitMbtiDirect(userId, mbtiType)` — validate 16 types, set confidence=100, save
  - `saveBirthProfile(userId, req)` — save to mirror_birth_profile, clear dashboard cache
  - `getBirthProfile(userId)` — read from mirror_birth_profile
  - `getProfile(userId)` — read from user_mirror_profile (used by other services)

### Task 3.3: MBTI Swipe Test Component

**Files:**
- Create: `miniprogram/components/mbti-swipe-test/*` (4 files)

- [ ] Full-screen overlay. 20 questions hardcoded in JS. Progress bar (04/20). Swipe right=1, left=-1, tap "不确定"=0. Three buttons at bottom. Close button top-right with confirm dialog. Fires `complete` event with `{ testVersion: 'v1', answers: [...] }`. Questions cover E_I, S_N, T_F, J_P (5 each).

### Task 3.4: MBTI Picker Modal Component

**Files:**
- Create: `miniprogram/components/mbti-picker-modal/*` (4 files)

- [ ] Bottom sheet or full-screen modal. Four toggle groups (E/I, S/N, T/F, J/P). Large MBTI display. Chinese title below. Confirm button. Fires `confirm` event with `{ mbtiType }`. Default INTJ.

### Task 3.5: Wire MBTI into Home Page

- [ ] Update `index.json` to register new components
- [ ] Update `index.wxml` to include `mbti-swipe-test` and `mbti-picker-modal` with wx:if
- [ ] Verify: uncalibrated state shows buttons, clicking opens correct component, completing refreshes dashboard

### Task 3.6: Commit Phase 3

```bash
git add backend/src/main/java/com/smartrecord/service/impl/MbtiCalculator.java backend/src/main/java/com/smartrecord/service/impl/MirrorProfileServiceImpl.java miniprogram/components/mbti-swipe-test/ miniprogram/components/mbti-picker-modal/ miniprogram/pages/mirror/index.*
git commit -m "feat(mirror): MBTI校准 - 计算器、Profile服务、滑动测试、直接输入"
```

---

## Phase 4: Tool Run Pipeline

### Task 4.1: MirrorToolServiceImpl

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorToolServiceImpl.java`

- [ ] Implements `MirrorToolService`. Core method `runTool(userId, req)`:
  1. Parse tool code → `MirrorToolType.fromCode(req.getTool())`
  2. Validate question requirement (if `requiresQuestion` and question blank → BizException)
  3. Check birth profile requirement (if `requiresBirthProfile` → check params or DB)
  4. If `params.saveBirthProfile=true` → save to mirror_birth_profile
  5. Build taibu input JSON from params + tool-specific logic
  6. Call `taibuService.execute(toolType.getCode(), inputJson)`
  7. Parse result JSON → TaibuRunResult
  8. Call `mirrorInterpretService.interpret(toolType, taibuResult, question, mbtiProfile)`
  9. Save mirror_report
  10. Clear dashboard Redis cache
  11. Return MirrorToolRunResp

- [ ] For astrology: detect and return locked response with "暂不支持" instead of calling taibu.

### Task 4.2: Taibu Parameter Assembly

- [ ] Inside MirrorToolServiceImpl, add private method `buildTaibuInput(MirrorToolType type, Map<String, Object> params, MirrorBirthProfile birth)` that constructs the JSON string for each tool:
  - tarot: `{ "spread": "single", "allowReversed": true }`
  - meihua: `{ "method": "time" }` or `{ "method": "numbers", "numbers": [3,8] }`
  - xiaoliuren: `{ "method": "time" }`
  - liuyao: `{ "method": "auto" }`
  - qimen: `{ "useCurrentTime": true }`
  - almanac: `{ "date": "2026-06-05" }`
  - taiyi: `{ "mode": "day", "date": "...", "hour": N, "minute": N }`
  - bazi: `{ "date": "...", "time": "...", "gender": "...", "calendar": "solar" }`
  - ziwei: same as bazi
  - advanced tools: same pattern

### Task 4.3: MirrorReportServiceImpl

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorReportServiceImpl.java`

- [ ] Methods:
  - `saveReport(MirrorReport report)` — insert
  - `getReport(userId, id)` — select by id + userId check, convert to MirrorReportResp
  - `getArchive(userId, page, pageSize, category)` — paged query with optional category filter, convert to MirrorArchiveItem list
  - `getRecentReports(userId, limit)` — select latest N for dashboard

### Task 4.4: Tool Input Page (Frontend)

**Files:**
- Create: `miniprogram/pages/mirror/tool/index.*` (4 files)

- [ ] Dynamic form based on `tool` query param. Uses `MirrorToolType` info to show/hide:
  - Question input (for QUICK tools)
  - Birth date/time/gender/calendar inputs (for PROFILE/ADVANCED)
  - Tool-specific params (spread, method, etc.)
  - "开始测试" button
  - Safety disclaimer above button
  - On submit: call `api.runMirrorTool(data)`, on success navigate to `/pages/mirror/report/index?id={reportId}`

### Task 4.5: Report Detail Page (Frontend)

**Files:**
- Create: `miniprogram/pages/mirror/report/index.*` (4 files)

- [ ] Loads report by `id` query param via `api.getMirrorReport(id)`. Shows:
  - Tool name + date
  - Question card (if exists)
  - Result card (normalized data, not raw)
  - Interpretation summary
  - Suggestions list
  - Warnings list
  - Collapsible "原始数据" section for raw_result
  - Source badge (taibu/mimo/fallback) — if fallback, show "低置信度参考"
  - Bottom safety disclaimer

### Task 4.6: Commit Phase 4

```bash
git add backend/src/main/java/com/smartrecord/service/impl/MirrorToolServiceImpl.java backend/src/main/java/com/smartrecord/service/impl/MirrorReportServiceImpl.java miniprogram/pages/mirror/tool/ miniprogram/pages/mirror/report/
git commit -m "feat(mirror): 工具运行 - ToolService、ReportService、工具输入页、结果详情页"
```

---

## Phase 5: Interpretation Layer

### Task 5.1: MirrorInterpretFallbackPool

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorInterpretFallbackPool.java`

- [ ] Static pool of fallback interpretations keyed by MirrorToolType. Each tool has 3+ fallback entries. Each entry is a `MirrorInterpretation` object with safe, non-committal language. Method: `fallback(MirrorToolType, UserMirrorProfile, TaibuRunResult)` picks randomly from pool.

### Task 5.2: MirrorContentGuard

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorContentGuard.java`

- [ ] Checks interpretation text for 12 forbidden words: 必胜, 稳赚, 发财, 梭哈, 加注, 借钱, 贷款, 翻本, 改命, 化灾, 血光, 死亡. Method: `boolean isSafe(MirrorInterpretation interp)` — returns false if any forbidden word found. Also has `MirrorInterpretation sanitize(MirrorInterpretation interp)` that replaces unsafe interpretation with fallback.

### Task 5.3: MirrorInterpretServiceImpl

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorInterpretServiceImpl.java`

- [ ] Implements `MirrorInterpretService`. Method `interpret(toolType, taibuResult, question, mbtiProfile)`:
  1. Build LLM prompt from system prompt (Oracle-7) + input JSON
  2. Call MiMo LLM via Hutool HTTP (reusing FortuneServiceImpl pattern)
  3. 3-second timeout via CompletableFuture
  4. Parse JSON response → MirrorInterpretation
  5. Run ContentGuard check → if unsafe, use fallback
  6. On any failure (timeout, parse error, API error) → use FallbackPool
  7. Return MirrorInterpretation

- [ ] System prompt from spec (Oracle-7 role, hard boundaries, style rules, output JSON schema, interpretation rules per tool type).

### Task 5.4: Commit Phase 5

```bash
git add backend/src/main/java/com/smartrecord/service/impl/MirrorInterpretFallbackPool.java backend/src/main/java/com/smartrecord/service/impl/MirrorContentGuard.java backend/src/main/java/com/smartrecord/service/impl/MirrorInterpretServiceImpl.java
git commit -m "feat(mirror): 解释层 - MiMo LLM接入、FallbackPool、ContentGuard"
```

---

## Phase 6: Dashboard Service + Archive

### Task 6.1: MirrorServiceImpl (Dashboard Aggregation)

**Files:**
- Create: `backend/src/main/java/com/smartrecord/service/impl/MirrorServiceImpl.java`

- [ ] Implements `MirrorService`. Method `getDashboard(userId)`:
  1. Check Redis cache `sr:mirror:dashboard:{userId}` (TTL 5min)
  2. On miss: parallel fetch MBTI profile, birth profile, today field, recent reports
  3. Build tool lists: for each MirrorToolType, compute locked status (requiresBirthProfile && no profile → locked, astrology → locked)
  4. Build todayUsed flags from Redis `sr:mirror:tool:used:{userId}:{tool}:{date}`
  5. Assemble MirrorDashboardResp
  6. Cache result
  7. On Redis exception: return data without caching (no error to frontend)

### Task 6.2: Today Field Generation

- [ ] Inside MirrorServiceImpl, add `getOrCreateDailyField(userId)`:
  1. Check Redis `sr:mirror:field:{userId}:{date}`
  2. Check MySQL mirror_daily_field
  3. On miss: call `taibuService.execute("almanac", ...)` and `taibuService.execute("taiyi", ...)`
  4. Generate summary + tag from results
  5. Save to MySQL + Redis (TTL = midnight + random 0-30min jitter)
  6. Return DailyFieldInfo

### Task 6.3: Archive Page (Frontend)

**Files:**
- Create: `miniprogram/pages/mirror/archive/index.*` (4 files)

- [ ] Filter tabs: 全部 / 快速占测 / 命盘画像 / 高级推演 / 今日场域. Maps category to tool types for API filter. Paged list with pull-down refresh and reach-bottom load more. Each item shows tool name, title, tag, question snippet, time. Click → navigate to report detail.

### Task 6.4: Commit Phase 6

```bash
git add backend/src/main/java/com/smartrecord/service/impl/MirrorServiceImpl.java miniprogram/pages/mirror/archive/
git commit -m "feat(mirror): Dashboard聚合、今日场域、档案页"
```

---

## Phase 7: Integration + Polish

### Task 7.1: Redis Cache Key Registration

- [ ] Verify all Redis keys use `sr:mirror:` prefix
- [ ] Verify cache invalidation: MBTI update → clear dashboard + profile; birth profile save → clear dashboard; tool run → clear dashboard + set tool:used
- [ ] Verify Redis exception handling: all cache ops wrapped in try-catch with warn log

### Task 7.2: Global Styles for Mirror Module

**Files:**
- Modify: `miniprogram/app.wxss` (add mirror-specific utility classes if needed)

- [ ] Verify: `.reduce-motion *` rule covers mirror animations
- [ ] Add any missing utility classes (`.glass-card`, `.cyber-border`, etc. if not already present)

### Task 7.3: Frontend Polish

- [ ] Verify all pages show skeleton during loading
- [ ] Verify locked tools show lockReason toast, don't navigate
- [ ] Verify reduce-motion toggle works
- [ ] Verify safety disclaimers appear on: home page bottom, tool page above button, report page bottom
- [ ] Verify no emoji in any WXML
- [ ] Verify all text colors use the defined hierarchy

### Task 7.4: Backend Compilation Check

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] Fix any compilation errors

### Task 7.5: Final Commit

```bash
git add -A
git commit -m "feat(mirror): 镜像模块完整实现 - MBTI校准、taibu工具、解释层、档案、前端页面"
```

---

## Verification

1. **Backend compiles:** `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile`
2. **Frontend loads:** Import `miniprogram/` in WeChat DevTools, navigate to mirror tab
3. **Dashboard API:** `GET /api/mirror/dashboard` returns tool lists (initially all unlocked except astrology and birth-dependent tools)
4. **MBTI flow:** Direct input → profile saved → dashboard shows calibrated state
5. **Tool run:** Submit meihua with question → taibu executes → report saved → navigate to result
6. **Archive:** After 1+ reports, archive page shows results with pagination
