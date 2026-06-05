package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smartrecord.common.BizException;
import com.smartrecord.dto.mirror.*;
import com.smartrecord.entity.MirrorBirthProfile;
import com.smartrecord.entity.MirrorReport;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.enums.MirrorToolType;
import com.smartrecord.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorToolServiceImpl implements MirrorToolService {

    private final TaibuService taibuService;
    private final MirrorInterpretService mirrorInterpretService;
    private final MirrorReportService mirrorReportService;
    private final MirrorProfileService mirrorProfileService;
    private final StringRedisTemplate redisTemplate;

    private static final String CACHE_KEY_DASHBOARD = "sr:mirror:dashboard:";
    private static final String CACHE_KEY_TOOL_USED = "sr:mirror:tool:used:";

    @Override
    public MirrorToolRunResp runTool(Long userId, MirrorToolRunReq req) {
        MirrorToolType toolType = MirrorToolType.fromCode(req.getTool());

        // 校验问题需求
        if (toolType.isRequiresQuestion() && (req.getQuestion() == null || req.getQuestion().isBlank())) {
            throw new BizException(toolType.getDisplayName() + " 需要输入问题");
        }

        // 校验出生档案需求
        MirrorBirthProfile birthProfile = mirrorProfileService.getBirthProfileEntity(userId);
        Map<String, Object> params = req.getParams() != null ? req.getParams() : new HashMap<>();

        if (toolType.isRequiresBirthProfile()) {
            if (birthProfile == null && !hasInlineBirthInfo(params)) {
                throw new BizException(toolType.getDisplayName() + " 需要先建立命盘档案");
            }
            // 保存内联出生信息
            if (birthProfile == null && hasInlineBirthInfo(params) && Boolean.TRUE.equals(params.get("saveBirthProfile"))) {
                BirthProfileReq bpReq = new BirthProfileReq();
                bpReq.setCalendarType((String) params.getOrDefault("calendarType", "solar"));
                bpReq.setBirthDate((String) params.get("birthDate"));
                bpReq.setBirthTime((String) params.get("birthTime"));
                bpReq.setBirthPlace((String) params.get("birthPlace"));
                bpReq.setTimezone((String) params.getOrDefault("timezone", "Asia/Shanghai"));
                bpReq.setGender((String) params.get("gender"));
                mirrorProfileService.saveBirthProfile(userId, bpReq);
                birthProfile = mirrorProfileService.getBirthProfileEntity(userId);
            }
        }

        // 检查 taibu 可用性
        if (!toolType.isTaibuAvailable()) {
            throw new BizException(toolType.getDisplayName() + " 暂不可用");
        }

        // 构建 taibu 参数
        String inputJson = buildTaibuInput(toolType, params, birthProfile);

        // 调用 taibu
        TaibuRunResult taibuResult;
        try {
            String rawJson = taibuService.execute(toolType.getCode(), inputJson);
            taibuResult = parseTaibuResult(rawJson);
        } catch (Exception e) {
            log.warn("taibu 执行失败: tool={}, error={}", toolType.getCode(), e.getMessage());
            taibuResult = TaibuRunResult.builder()
                    .success(false)
                    .error(e.getMessage())
                    .rawResult(Map.of("error", e.getMessage()))
                    .normalizedResult(Map.of())
                    .build();
        }

        // 获取 MBTI profile 作为解释上下文
        UserMirrorProfile mbtiProfile = mirrorProfileService.getProfile(userId);

        // 生成解释
        MirrorInterpretation interpretation = mirrorInterpretService.interpret(
                toolType, taibuResult, req.getQuestion(), mbtiProfile);

        // 保存报告
        MirrorReport report = new MirrorReport();
        report.setUserId(userId);
        report.setToolType(toolType.getCode());
        report.setQuestion(req.getQuestion());
        report.setTitle(interpretation.getTitle() != null ? interpretation.getTitle() : toolType.getDisplayName());
        report.setRawResult(taibuResult.getRawResult());
        report.setNormalizedResult(taibuResult.getNormalizedResult());
        report.setMbtiSnapshot(mbtiProfile != null ? Map.of(
                "type", mbtiProfile.getMbtiType() != null ? mbtiProfile.getMbtiType() : "",
                "title", mbtiProfile.getMbtiTitle() != null ? mbtiProfile.getMbtiTitle() : "",
                "confidence", mbtiProfile.getMbtiConfidence() != null ? mbtiProfile.getMbtiConfidence().toString() : "0"
        ) : null);
        report.setInterpretation(interpretation != null ? Map.of(
                "title", interpretation.getTitle() != null ? interpretation.getTitle() : "",
                "tag", interpretation.getTag() != null ? interpretation.getTag() : "",
                "themeColor", interpretation.getThemeColor() != null ? interpretation.getThemeColor() : "#0A84FF",
                "confidence", interpretation.getConfidence() != null ? interpretation.getConfidence() : "LOW",
                "summary", interpretation.getSummary() != null ? interpretation.getSummary() : "",
                "suggestions", interpretation.getSuggestions() != null ? interpretation.getSuggestions() : java.util.List.of(),
                "warnings", interpretation.getWarnings() != null ? interpretation.getWarnings() : java.util.List.of()
        ) : null);
        report.setSummary(interpretation.getSummary());
        report.setSuggestions(interpretation.getSuggestions());
        report.setWarnings(interpretation.getWarnings());
        report.setThemeColor(interpretation.getThemeColor());
        report.setTag(interpretation.getTag());
        report.setSource(taibuResult.isSuccess() ? "taibu" : "fallback");

        mirrorReportService.saveReport(report);

        // 标记今日已用
        markToolUsed(userId, toolType.getCode());

        // 清除 dashboard 缓存
        clearDashboardCache(userId);

        return MirrorToolRunResp.builder()
                .reportId(report.getId())
                .tool(toolType.getCode())
                .toolName(toolType.getDisplayName())
                .title(report.getTitle())
                .tag(report.getTag())
                .themeColor(report.getThemeColor())
                .question(req.getQuestion())
                .normalizedResult(taibuResult.getNormalizedResult())
                .interpretation(interpretation)
                .source(report.getSource())
                .build();
    }

    private String buildTaibuInput(MirrorToolType type, Map<String, Object> params, MirrorBirthProfile birth) {
        JSONObject input = new JSONObject();

        switch (type) {
            case TAROT -> {
                input.set("spread", params.getOrDefault("spread", "single"));
                input.set("allowReversed", params.getOrDefault("allowReversed", true));
            }
            case MEIHUA -> {
                input.set("method", params.getOrDefault("method", "time"));
                if (params.containsKey("numbers")) input.set("numbers", params.get("numbers"));
                if (params.containsKey("word")) input.set("word", params.get("word"));
            }
            case XIAOLIUREN -> {
                input.set("method", params.getOrDefault("method", "time"));
                if (params.containsKey("number")) input.set("number", params.get("number"));
            }
            case LIUYAO -> {
                input.set("method", params.getOrDefault("method", "auto"));
                if (params.containsKey("numbers")) input.set("numbers", params.get("numbers"));
            }
            case QIMEN -> {
                input.set("useCurrentTime", params.getOrDefault("useCurrentTime", true));
            }
            case ALMANAC -> {
                input.set("date", params.getOrDefault("date", LocalDate.now().toString()));
            }
            case TAIYI -> {
                LocalDate date = LocalDate.now();
                LocalTime now = LocalTime.now();
                input.set("mode", "day");
                input.set("date", params.getOrDefault("date", date.toString()));
                input.set("hour", params.getOrDefault("hour", now.getHour()));
                input.set("minute", params.getOrDefault("minute", now.getMinute()));
            }
            case BAZI, ZIWEI, BAZI_DAYUN, BAZI_PILLARS_RESOLVE, ZIWEI_HOROSCOPE, ZIWEI_FLYING_STAR, DALIUREN -> {
                // 优先用 params 中的内联信息，其次用 birthProfile
                String birthDate = (String) params.get("birthDate");
                String birthTime = (String) params.get("birthTime");
                String gender = (String) params.get("gender");
                String calType = (String) params.getOrDefault("calendarType", "solar");

                if (birthDate == null && birth != null) {
                    birthDate = birth.getBirthDate() != null ? birth.getBirthDate().toString() : null;
                    birthTime = birth.getBirthTime();
                    gender = birth.getGender();
                    calType = birth.getCalendarType();
                }

                input.set("date", birthDate);
                input.set("time", birthTime);
                input.set("gender", gender);
                input.set("calendar", calType);
            }
            default -> {
                // 透传所有 params
                params.forEach(input::set);
            }
        }

        return input.toString();
    }

    private TaibuRunResult parseTaibuResult(String rawJson) {
        try {
            JSONObject obj = JSONUtil.parseObj(rawJson);
            if (obj.containsKey("error")) {
                return TaibuRunResult.builder()
                        .success(false)
                        .error(obj.getStr("error"))
                        .rawResult(obj)
                        .normalizedResult(Map.of())
                        .build();
            }
            return TaibuRunResult.builder()
                    .success(true)
                    .rawResult(obj)
                    .normalizedResult(obj) // 首版直接透传，后续可做标准化
                    .build();
        } catch (Exception e) {
            return TaibuRunResult.builder()
                    .success(false)
                    .error("结果解析失败")
                    .rawResult(Map.of("raw", rawJson))
                    .normalizedResult(Map.of())
                    .build();
        }
    }

    private boolean hasInlineBirthInfo(Map<String, Object> params) {
        return params.containsKey("birthDate") && params.get("birthDate") != null;
    }

    private void markToolUsed(Long userId, String toolCode) {
        try {
            String key = CACHE_KEY_TOOL_USED + userId + ":" + toolCode + ":" + LocalDate.now();
            redisTemplate.opsForValue().set(key, "1", 24 + (int) (Math.random() * 0.5), TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("标记工具使用失败: userId={}, tool={}", userId, toolCode);
        }
    }

    private void clearDashboardCache(Long userId) {
        try {
            redisTemplate.delete(CACHE_KEY_DASHBOARD + userId);
        } catch (Exception e) {
            log.warn("清除dashboard缓存失败: userId={}", userId);
        }
    }
}
