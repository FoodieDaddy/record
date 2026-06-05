package com.smartrecord.service.impl;

import cn.hutool.json.JSONUtil;
import com.smartrecord.dto.mirror.DailyFieldResp;
import com.smartrecord.dto.mirror.MirrorDashboardResp;
import com.smartrecord.dto.mirror.MirrorDashboardResp.*;
import com.smartrecord.entity.MirrorBirthProfile;
import com.smartrecord.entity.MirrorReport;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.enums.MirrorToolType;
import com.smartrecord.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorServiceImpl implements MirrorService {

    private final MirrorProfileService mirrorProfileService;
    private final MirrorReportService mirrorReportService;
    private final TaibuService taibuService;
    private final StringRedisTemplate redisTemplate;

    private static final String CACHE_KEY_DASHBOARD = "sr:mirror:dashboard:";
    private static final String CACHE_KEY_FIELD = "sr:mirror:field:";
    private static final String CACHE_KEY_TOOL_USED = "sr:mirror:tool:used:";
    private static final long DASHBOARD_CACHE_TTL_MIN = 5;

    @Override
    public MirrorDashboardResp getDashboard(Long userId) {
        // 尝试读取缓存
        String cacheKey = CACHE_KEY_DASHBOARD + userId;
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return JSONUtil.parseObj(cached).toBean(MirrorDashboardResp.class);
            }
        } catch (Exception e) {
            log.warn("读取dashboard缓存失败: userId={}", userId);
        }

        // 构建数据
        MirrorDashboardResp resp = buildDashboard(userId);

        // 写入缓存
        try {
            redisTemplate.opsForValue().set(cacheKey, JSONUtil.toJsonStr(resp), DASHBOARD_CACHE_TTL_MIN, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("写入dashboard缓存失败: userId={}", userId);
        }

        return resp;
    }

    private MirrorDashboardResp buildDashboard(Long userId) {
        // MBTI profile
        UserMirrorProfile profile = mirrorProfileService.getProfile(userId);
        ProfileInfo profileInfo = buildProfileInfo(profile);

        // 出生档案
        MirrorBirthProfile birthProfile = mirrorProfileService.getBirthProfileEntity(userId);
        BirthProfileInfo birthInfo = buildBirthProfileInfo(birthProfile);

        // 今日场域
        DailyFieldInfo fieldInfo = getOrCreateDailyField(userId);

        // 工具列表
        List<ToolItem> allTools = buildToolList(profile, birthProfile, userId);
        List<ToolItem> quickTools = allTools.stream().filter(t -> "QUICK".equals(t.getCategory())).toList();
        List<ToolItem> profileTools = allTools.stream().filter(t -> "PROFILE".equals(t.getCategory())).toList();
        List<ToolItem> advancedTools = allTools.stream().filter(t -> "ADVANCED".equals(t.getCategory())).toList();

        // 最近结果
        List<MirrorReport> recentReports = mirrorReportService.getRecentReports(userId, 3);
        List<RecentReport> recentList = recentReports.stream().map(r -> {
            MirrorToolType tt;
            try { tt = MirrorToolType.fromCode(r.getToolType()); } catch (Exception e) { tt = null; }
            return RecentReport.builder()
                    .id(r.getId())
                    .toolType(r.getToolType())
                    .toolName(tt != null ? tt.getDisplayName() : r.getToolType())
                    .title(r.getTitle())
                    .tag(r.getTag())
                    .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : null)
                    .timeText(formatTimeText(r.getCreatedAt()))
                    .build();
        }).toList();

        return MirrorDashboardResp.builder()
                .profile(profileInfo)
                .todayField(fieldInfo)
                .quickTools(quickTools)
                .profileTools(profileTools)
                .advancedTools(advancedTools)
                .recentReports(recentList)
                .birthProfile(birthInfo)
                .build();
    }

    private ProfileInfo buildProfileInfo(UserMirrorProfile p) {
        if (p == null || p.getMbtiType() == null) {
            return ProfileInfo.builder().calibrated(false).build();
        }
        return ProfileInfo.builder()
                .calibrated(true)
                .mbtiType(p.getMbtiType())
                .mbtiTitle(p.getMbtiTitle())
                .confidence(p.getMbtiConfidence())
                .mbtiSource(p.getMbtiSource())
                .calibratedAt(p.getCalibratedAt() != null ? p.getCalibratedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : null)
                .build();
    }

    private BirthProfileInfo buildBirthProfileInfo(MirrorBirthProfile bp) {
        if (bp == null || bp.getBirthDate() == null) {
            return BirthProfileInfo.builder().exists(false).build();
        }
        String brief = bp.getBirthDate().getYear() + "年 " +
                ("lunar".equals(bp.getCalendarType()) ? "农历" : "阳历");
        return BirthProfileInfo.builder().exists(true).briefText(brief).build();
    }

    private DailyFieldInfo getOrCreateDailyField(Long userId) {
        LocalDate today = LocalDate.now();
        String dateKey = today.toString();

        // 尝试从 Redis 读取
        String cacheKey = CACHE_KEY_FIELD + userId + ":" + dateKey;
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return JSONUtil.parseObj(cached).toBean(DailyFieldInfo.class);
            }
        } catch (Exception e) {
            log.warn("读取场域缓存失败: userId={}", userId);
        }

        // 生成今日场域
        DailyFieldInfo fieldInfo = generateDailyField(today);

        // 写入 Redis（到次日凌晨 + 随机抖动）
        try {
            long secondsUntilMidnight = ChronoUnit.SECONDS.between(
                    java.time.LocalDateTime.now(),
                    today.plusDays(1).atStartOfDay());
            long jitter = (long) (Math.random() * 30 * 60); // 0-30 分钟随机
            redisTemplate.opsForValue().set(cacheKey, JSONUtil.toJsonStr(fieldInfo),
                    secondsUntilMidnight + jitter, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("写入场域缓存失败: userId={}", userId);
        }

        return fieldInfo;
    }

    private DailyFieldInfo generateDailyField(LocalDate date) {
        // 调用太乙和黄历
        String tag = "平稳";
        String summary = "今日适合按部就班，保持节奏。";
        String themeColor = "#0A84FF";

        try {
            String taiyiText = taibuService.getTodayTaiyiText();
            if (taiyiText != null && !taiyiText.isEmpty() && !taiyiText.contains("error")) {
                // 简单提取关键词作为 tag
                if (taiyiText.contains("吉")) { tag = "活跃"; themeColor = "#30D158"; }
                else if (taiyiText.contains("凶")) { tag = "谨慎"; themeColor = "#FF9F0A"; }
                summary = "太乙九星推演完成，点击查看详细场域分析。";
            }
        } catch (Exception e) {
            log.warn("生成今日场域失败", e);
        }

        return DailyFieldInfo.builder()
                .tag(tag)
                .summary(summary)
                .themeColor(themeColor)
                .date(date.toString())
                .build();
    }

    private List<ToolItem> buildToolList(UserMirrorProfile profile, MirrorBirthProfile birth, Long userId) {
        boolean hasMbti = profile != null && profile.getMbtiType() != null;
        boolean hasBirth = birth != null && birth.getBirthDate() != null;
        String today = LocalDate.now().toString();

        List<ToolItem> items = new ArrayList<>();
        for (MirrorToolType type : MirrorToolType.values()) {
            boolean locked = false;
            String lockReason = null;

            if (type.isRequiresBirthProfile() && !hasBirth) {
                locked = true;
                lockReason = "需要先建立命盘档案";
            }
            if (!type.isTaibuAvailable()) {
                locked = true;
                lockReason = "暂不可用";
            }

            boolean todayUsed = isToolUsed(userId, type.getCode(), today);

            items.add(ToolItem.builder()
                    .key(type.getCode())
                    .code(type.getCode())
                    .name(type.getDisplayName())
                    .desc(type.getDescription())
                    .category(type.getCategory())
                    .locked(locked)
                    .lockReason(lockReason)
                    .todayUsed(todayUsed)
                    .build());
        }
        return items;
    }

    private boolean isToolUsed(Long userId, String toolCode, String date) {
        try {
            String key = CACHE_KEY_TOOL_USED + userId + ":" + toolCode + ":" + date;
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (Exception e) {
            return false;
        }
    }

    private String formatTimeText(java.time.LocalDateTime dateTime) {
        if (dateTime == null) return "";
        long minutes = ChronoUnit.MINUTES.between(dateTime, java.time.LocalDateTime.now());
        if (minutes < 1) return "刚刚";
        if (minutes < 60) return minutes + "分钟前";
        long hours = ChronoUnit.HOURS.between(dateTime, java.time.LocalDateTime.now());
        if (hours < 24) return hours + "小时前";
        long days = ChronoUnit.DAYS.between(dateTime, java.time.LocalDateTime.now());
        return days + "天前";
    }
}
