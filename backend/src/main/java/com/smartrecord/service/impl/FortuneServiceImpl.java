package com.smartrecord.service.impl;

import cn.hutool.http.Header;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smartrecord.dto.fortune.FortuneResp;
import com.smartrecord.dto.fortune.UserTag;
import com.smartrecord.entity.FortuneLog;
import com.smartrecord.mapper.FortuneLogMapper;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.service.FortuneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class FortuneServiceImpl implements FortuneService {

    private final RoomMemberMapper roomMemberMapper;
    private final RoomMapper roomMapper;
    private final FortuneLogMapper fortuneLogMapper;
    private final Executor asyncExecutor;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.llm.api-url:}")
    private String apiUrl;

    @Value("${app.llm.api-key:}")
    private String apiKey;

    @Value("${app.llm.model:mimo-v2.5}")
    private String model;

    /** 每日策略 Redis 缓存 key */
    private static final String FORTUNE_CACHE_KEY = "sr:fortune:";
    private static final long CACHE_TTL_HOURS = 4;
    private static final List<String> SENSITIVE_WORDS = List.of(
            "\u68cb\u724c", "\u8d4c\u535a", "\u8d4c", "\u4e0b\u6ce8", "\u62bc\u6ce8", "\u7b79\u7801",
            "\u724c\u5c40", "\u724c\u684c", "\u6253\u724c", "\u9ebb\u5c06", "\u6251\u514b", "\u5fb7\u5dde",
            "\u68ad\u54c8", "\u8d62\u94b1", "\u8d5a\u94b1", "\u53d1\u8d22", "\u7a33\u8d5a", "\u5fc5\u80dc",
            "\u7ffb\u672c", "\u8ffd\u635f", "\u7b97\u547d", "\u5360\u535c", "\u5854\u7f57", "\u62bd\u724c",
            "\u795e\u8c15", "\u5366\u8c61", "\u9ec4\u5386", "\u98ce\u6c34", "\u9884\u6d4b\u8f93\u8d62",
            "\u80dc\u7387\u63d0\u5347", "ALL-IN", "\u8fd0\u52bf", "\u8f6c\u8fd0", "\u5f00\u8fd0",
            "\u6539\u547d", "\u6a2a\u8d22", "\u724c\u8fd0", "\u8d22\u8fd0",
            "\u7ffb\u76d8", "\u6b62\u635f\u7ebf", "\u5b64\u6ce8\u4e00\u63b7", "\u80dc\u7387"
    );

    /** LLM 系统提示词（常量，供日志记录复用） */
    private static final String SYSTEM_PROMPT = """
            你是「脉冲终端」中的策略解释引擎，代号 ORACLE CORE。

            你是状态复盘与节奏校准系统，不判断结果，不承诺任何反馈。

            规则：
            - 用赛博科幻词汇和时间窗口/节奏窗口/环境变量等意象，映射到任务痛点（情绪波动、节奏管理、风险控制）
            - 避免非策略化词汇、结果断言和利益承诺
            - 输出复盘建议和状态管理，语气冷静克制、赛博飞船终端感
            - 不使用emoji，不使用空泛套话，不制造焦虑
            - 使用时间窗口、节奏窗口、环境变量等表达方式

            字段：tag(4字)、verdict(10-18字冷酷忠告，融合节奏/环境意象)、buffs(3个5-7字策略优势)、debuffs(2个5-7字隐患)

            只输出JSON，不要其他文字：
            {"themeColor":"#HEX","tag":"4字","verdict":"10-18字","buffs":["优势1","优势2","优势3"],"debuffs":["预警1","预警2"]}
            颜色：稳健=#0A84FF 连胜=#32D74B 连败=#FF9F0A 高波动=#FF453A
            """;

    // ===== 兜底静态策略池 =====

    /** 策略原型 */
    private static class Archetype {
        final String title;
        final String subtitle;
        final List<String> keywords;
        Archetype(String title, String subtitle, List<String> keywords) {
            this.title = title;
            this.subtitle = subtitle;
            this.keywords = keywords;
        }
    }

    /** 策略原型池：UserTag → 可选原型列表 */
    private static final Map<UserTag, List<Archetype>> ARCHETYPE_POOL = new EnumMap<>(UserTag.class);

    private static final Map<UserTag, List<FortuneResp>> FALLBACK_POOL = new EnumMap<>(UserTag.class);

    static {
        FALLBACK_POOL.put(UserTag.WINNING_STREAK, List.of(
                buildFallback("当前节奏较顺，建议保持低噪执行",
                        List.of("节奏连续", "注意力稳定", "执行链路清晰"),
                        List.of("降低加速冲动", "保留复盘窗口"),
                        "#32D74B", "理智"),
                buildFallback("状态读数偏高，优先维持纪律边界",
                        List.of("判断同步", "反应稳定", "目标清楚"),
                        List.of("避免过度扩张", "控制操作频率"),
                        "#32D74B", "巡航"),
                buildFallback("主动节奏可用，但不要拉高风险阈值",
                        List.of("节奏主动", "信号明确", "执行果断"),
                        List.of("保持冷却间隔", "确认每次变动原因"),
                        "#32D74B", "稳态")
        ));

        FALLBACK_POOL.put(UserTag.LOSING_STREAK, List.of(
                buildFallback("波动读数偏低，先压缩操作半径",
                        List.of("复盘价值提升", "错误样本清晰", "节奏可重建"),
                        List.of("避免情绪化修正", "增加暂停检查"),
                        "#FF9F0A", "校准"),
                buildFallback("今日适合观察与复盘，不宜加速",
                        List.of("观察窗口打开", "复盘材料充足", "判断可回稳"),
                        List.of("惯性影响未消散", "控制投入节奏"),
                        "#FF6B35", "观察"),
                buildFallback("先修复节奏，再恢复强度",
                        List.of("回稳空间存在", "经验持续沉淀", "边界更清楚"),
                        List.of("切勿急于修正", "避免高风险操作"),
                        "#FF453A", "回稳")
        ));

        FALLBACK_POOL.put(UserTag.HIGH_RISK, List.of(
                buildFallback("波动读数较高，先把风险阈值下调",
                        List.of("校准意识增强", "场景识别较快", "调整空间充足"),
                        List.of("风险敞口较大", "情绪波动影响判断"),
                        "#FF2D55", "警戒"),
                buildFallback("当前状态起伏明显，建议降频处理",
                        List.of("关键节点敏感", "反馈速度较快", "复盘材料充足"),
                        List.of("结果波动较高", "需严格控制节奏"),
                        "#AF52DE", "过载"),
                buildFallback("纪律优先于强度，暂停线必须前置",
                        List.of("极端情境适应力", "抗压能力可用", "回稳意识增强"),
                        List.of("避免冒进心态", "务必设置暂停线"),
                        "#FF375F", "警戒")
        ));

        FALLBACK_POOL.put(UserTag.STABLE, List.of(
                buildFallback("当前基线平稳，按既定节奏推进",
                        List.of("心态平稳", "节奏稳定", "执行效率良好"),
                        List.of("主动性略低", "注意识别关键节点"),
                        "#0A84FF", "稳健"),
                buildFallback("今日无明显异常，保持常规检查",
                        List.of("稳定发挥", "低级错误较少", "边界意识清晰"),
                        List.of("可能错过窗口", "需要定时复盘"),
                        "#0A84FF", "均衡"),
                buildFallback("稳态区间可用，适合做长期记录",
                        List.of("风险控制出色", "长期节奏稳定", "心态韧性充足"),
                        List.of("短期强度不足", "需要适当提速"),
                        "#0A84FF", "巡航")
        ));

        ARCHETYPE_POOL.put(UserTag.WINNING_STREAK, List.of(
                new Archetype("控场者", "THE CONTROLLER", List.of("顺行", "连续", "控场")),
                new Archetype("开拓者", "THE PIONEER", List.of("主动", "突破", "先手")),
                new Archetype("决策者", "THE DECIDER", List.of("果断", "清晰", "执行"))
        ));
        ARCHETYPE_POOL.put(UserTag.LOSING_STREAK, List.of(
                new Archetype("蛰伏者", "THE WATCHER", List.of("隐忍", "积累", "时机")),
                new Archetype("观察者", "THE OBSERVER", List.of("耐心", "分析", "等待")),
                new Archetype("引路者", "THE GUIDE", List.of("引导", "顺势", "直觉"))
        ));
        ARCHETYPE_POOL.put(UserTag.HIGH_RISK, List.of(
                new Archetype("校准者", "THE CALIBRATOR", List.of("边界", "修正", "果断")),
                new Archetype("变阵者", "THE ADAPTER", List.of("变通", "灵活", "调整")),
                new Archetype("操盘手", "THE OPERATOR", List.of("控制", "节奏", "布局"))
        ));
        ARCHETYPE_POOL.put(UserTag.STABLE, List.of(
                new Archetype("决策者", "THE DECIDER", List.of("果断", "清晰", "执行")),
                new Archetype("观察者", "THE OBSERVER", List.of("耐心", "分析", "等待")),
                new Archetype("终审者", "THE JUDGE", List.of("冷静", "复盘", "总结"))
        ));
    }

    /** callLlm 内部传递日志信息的载体 */
    private static class LlmCallContext {
        String prompt;
        String rawResponse;
        long durationMs;
    }

    @Override
    public FortuneResp getTodayFortune(Long userId, boolean force) {
        // 0. 检查 Redis 缓存（每日策略 4 小时内复用，force 时跳过）
        String cacheKey = FORTUNE_CACHE_KEY + userId + ":" + getDateKey();
        if (!force) {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("命中每日策略缓存: userId={}", userId);
                FortuneResp resp = JSONUtil.parseObj(cached).toBean(FortuneResp.class);
                if (resp.getLunarDate() == null) fillTimeWindowFields(resp);
                // 缓存命中时补充策略原型（缓存中可能没有）
                if (resp.getTitle() == null) {
                    UserTag cachedTag = resp.getUserTag() != null ? UserTag.valueOf(resp.getUserTag()) : UserTag.STABLE;
                    Archetype cachedArchetype = pickArchetype(cachedTag);
                    resp.setTitle(cachedArchetype.title);
                    resp.setSubtitle(cachedArchetype.subtitle);
                    resp.setTags(cachedArchetype.keywords);
                }
                // 补充 nextRefreshAt
                try {
                    Long ttl = redisTemplate.getExpire(cacheKey, TimeUnit.SECONDS);
                    if (ttl != null && ttl > 0) {
                        java.time.LocalTime refreshTime = java.time.LocalTime.now().plusSeconds(ttl);
                        resp.setNextRefreshAt(refreshTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")));
                    }
                } catch (Exception e) {
                    log.warn("缓存命中时计算 nextRefreshAt 失败", e);
                }
                return resp;
            }
        } else {
            log.info("强制刷新策略: userId={}", userId);
            redisTemplate.delete(cacheKey);
        }

        // 1. 计算用户画像标签（从 room.all_record JSON 提取 per-batch score delta）
        List<Integer> recentScores = getRecentScoreDeltas(userId, 10);
        UserTag userTag = computeUserTag(recentScores);
        int netScore = recentScores.stream().mapToInt(Integer::intValue).sum();

        // 2. CompletableFuture 双引擎：LLM 主引擎 + 兜底
        FortuneResp result;
        boolean fromLlm = false;
        LlmCallContext llmCtx = new LlmCallContext();

        if (apiUrl != null && !apiUrl.isEmpty() && apiKey != null && !apiKey.isEmpty()) {
            try {
                FortuneResp llmResult = CompletableFuture
                        .supplyAsync(() -> callLlm(userTag, netScore, recentScores, llmCtx), asyncExecutor)
                        .orTimeout(60000, TimeUnit.MILLISECONDS)
                        .exceptionally(ex -> {
                            log.warn("LLM 调用超时/异常，降级到兜底: {}", ex.getMessage());
                            llmCtx.durationMs = 60000;
                            llmCtx.rawResponse = "异常: " + ex.getMessage();
                            return fallbackFortune(userTag);
                        })
                        .join();
                result = llmResult;
                fromLlm = "llm".equals(llmResult.getSource());
            } catch (Exception e) {
                log.warn("CompletableFuture 异常，降级到兜底: {}", e.getMessage());
                llmCtx.rawResponse = "异常: " + e.getMessage();
                result = fallbackFortune(userTag);
            }
        } else {
            log.info("LLM 未配置，直接使用兜底策略");
            llmCtx.rawResponse = "LLM 未配置，使用本地兜底";
            result = fallbackFortune(userTag);
        }

        // 2.5 填充策略原型
        Archetype archetype = pickArchetype(userTag);
        result.setTitle(archetype.title);
        result.setSubtitle(archetype.subtitle);
        result.setTags(archetype.keywords);

        // 3. 填充航段式时间窗口字段
        fillTimeWindowFields(result);

        // 4. 写入缓存
        result.setUserTag(userTag.name());
        if (!fromLlm) {
            result.setSource("fallback");
        }
        try {
            redisTemplate.opsForValue().set(cacheKey, JSONUtil.toJsonStr(result), CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("缓存策略失败: userId={}", userId, e);
        }

        // 4.5 计算下次可刷新时间
        try {
            Long ttl = redisTemplate.getExpire(cacheKey, TimeUnit.SECONDS);
            if (ttl != null && ttl > 0) {
                java.time.LocalTime refreshTime = java.time.LocalTime.now().plusSeconds(ttl);
                result.setNextRefreshAt(refreshTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")));
            }
        } catch (Exception e) {
            log.warn("计算 nextRefreshAt 失败", e);
        }

        // 5. 异步写入策略生成日志
        FortuneLog flog = new FortuneLog();
        flog.setUserId(userId);
        flog.setUserTag(userTag.name());
        flog.setSource(result.getSource());
        flog.setModel(fromLlm ? model : "");
        flog.setPrompt(llmCtx.prompt);
        flog.setSystemPrompt(fromLlm ? SYSTEM_PROMPT : "");
        flog.setRawResponse(llmCtx.rawResponse);
        flog.setResultJson(JSONUtil.toJsonStr(result));
        flog.setDurationMs((int) llmCtx.durationMs);
        flog.setSuccess(result.getSource() != null ? 1 : 0);
        flog.setErrorMsg(llmCtx.rawResponse != null && llmCtx.rawResponse.startsWith("异常") ? llmCtx.rawResponse : "");
        asyncExecutor.execute(() -> {
            try {
                fortuneLogMapper.insert(flog);
            } catch (Exception e) {
                log.warn("写入策略日志失败: userId={}", userId, e);
            }
        });

        return result;
    }

    /**
     * 从用户最近房间的 room.all_record JSON 中提取 per-batch score delta
     */
    private List<Integer> getRecentScoreDeltas(Long userId, int limit) {
        List<Long> roomIds = roomMemberMapper.selectUserRoomIds(userId, 10);
        List<Integer> result = new ArrayList<>();

        for (Long roomId : roomIds) {
            if (result.size() >= limit) break;
            String json = roomMapper.selectAllRecordById(roomId);
            if (json == null || json.isBlank() || "null".equals(json)) continue;

            try {
                cn.hutool.json.JSONArray records = cn.hutool.json.JSONUtil.parseArray(json);
                for (int i = 0; i < records.size(); i++) {
                    if (result.size() >= limit) break;
                    cn.hutool.json.JSONObject batch = records.getJSONObject(i);
                    cn.hutool.json.JSONArray scores = batch.getJSONArray("scores");
                    if (scores == null) continue;
                    for (int j = 0; j < scores.size(); j++) {
                        cn.hutool.json.JSONObject ps = scores.getJSONObject(j);
                        if (userId.equals(ps.getLong("userId"))) {
                            result.add(ps.getInt("score"));
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("解析房间 {} all_record 失败", roomId, e);
            }
        }
        return result;
    }

    /**
     * 根据近 10 场得分计算用户画像标签
     */
    private UserTag computeUserTag(List<Integer> recentScores) {
        if (recentScores == null || recentScores.isEmpty()) {
            return UserTag.STABLE;
        }

        // 连胜判定：最近 3+ 场连续正分
        if (recentScores.size() >= 3) {
            int tail = Math.min(3, recentScores.size());
            boolean allPositive = true;
            boolean allNegative = true;
            for (int i = recentScores.size() - tail; i < recentScores.size(); i++) {
                if (recentScores.get(i) <= 0) allPositive = false;
                if (recentScores.get(i) >= 0) allNegative = false;
            }
            if (allPositive) return UserTag.WINNING_STREAK;
            if (allNegative) return UserTag.LOSING_STREAK;
        }

        // 高波动判定：近 10 场最大值与最小值之差 > 500
        IntSummaryStatistics stats = recentScores.stream().mapToInt(Integer::intValue).summaryStatistics();
        if (stats.getMax() - stats.getMin() > 500) {
            return UserTag.HIGH_RISK;
        }

        return UserTag.STABLE;
    }

    /**
     * 调用 OpenAI 兼容 LLM API（含一次截断重试）
     */
    private FortuneResp callLlm(UserTag userTag, int netScore, List<Integer> recentScores, LlmCallContext ctx) {
        String prompt = buildPrompt(userTag, netScore, recentScores);
        ctx.prompt = prompt;

        // 首次调用
        String content = doLlmRequest(prompt, ctx);
        if (content != null) {
            return parseLlmResponse(content);
        }

        // 首次因 token 耗尽返回空，追加精简提示重试一次
        log.info("LLM 首次输出为空（token 耗尽），重试精简模式");
        ctx.prompt = prompt;
        content = doLlmRequest(prompt + "\n（请精简输出，控制在200字内）", ctx);
        if (content != null) {
            return parseLlmResponse(content);
        }

        throw new RuntimeException("LLM 重试后仍无有效输出");
    }

    /**
     * 执行单次 LLM HTTP 请求，返回解析后的 content；若 token 耗尽返回 null
     */
    private String doLlmRequest(String prompt, LlmCallContext ctx) {
        JSONObject requestBody = new JSONObject();
        requestBody.set("model", model);
        requestBody.set("temperature", 0.6);
        requestBody.set("max_tokens", 4096);
        requestBody.set("include_reasoning", false);

        JSONArray messages = new JSONArray();
        JSONObject systemMsg = new JSONObject();
        systemMsg.set("role", "system");
        systemMsg.set("content", SYSTEM_PROMPT);
        messages.add(systemMsg);

        JSONObject userMsg = new JSONObject();
        userMsg.set("role", "user");
        userMsg.set("content", prompt);
        messages.add(userMsg);
        requestBody.set("messages", messages);

        long start = System.currentTimeMillis();
        HttpResponse response = HttpRequest.post(apiUrl)
                .header(Header.AUTHORIZATION, "Bearer " + apiKey)
                .header(Header.CONTENT_TYPE, "application/json")
                .body(requestBody.toString())
                .timeout(60000)
                .execute();
        ctx.durationMs = System.currentTimeMillis() - start;

        if (!response.isOk()) {
            log.warn("LLM API 返回非 200: status={}, body={}", response.getStatus(), response.body());
            ctx.rawResponse = "HTTP " + response.getStatus() + ": " + response.body();
            throw new RuntimeException("LLM API error: " + response.getStatus());
        }

        log.info("LLM API 响应体: {}", response.body());
        ctx.rawResponse = response.body();

        JSONObject respJson = JSONUtil.parseObj(response.body());
        JSONObject choice = respJson.getJSONArray("choices").getJSONObject(0);
        JSONObject message = choice.getJSONObject("message");
        String content = message.getStr("content");
        String finishReason = choice.getStr("finish_reason", "");

        // token 耗尽且 content 为空 → 返回 null 让调用方重试
        if ((content == null || content.isBlank()) && "length".equals(finishReason)) {
            log.warn("LLM 输出被截断（finish_reason=length），content 为空");
            return null;
        }

        if (content == null || content.isBlank()) {
            content = message.getStr("reasoning_content");
        }
        if (content == null || content.isBlank()) {
            throw new RuntimeException("LLM 返回空内容");
        }

        return content;
    }

    /**
     * 构建 LLM Prompt
     */
    private String buildPrompt(UserTag userTag, int netScore, List<Integer> recentScores) {
        String tagDesc = switch (userTag) {
            case WINNING_STREAK -> "近期正反馈连续，状态高昂，执行顺畅";
            case LOSING_STREAK -> "近期负反馈连续，状态低迷，心态受挫";
            case HIGH_RISK -> "高波动型，节奏起伏明显";
            case STABLE -> "稳健型，表现平稳，不温不火";
        };

        String timeContext = getTimeWindowContext();

        String trend = recentScores.size() >= 3
                ? recentScores.subList(recentScores.size() - 3, recentScores.size()).toString()
                : recentScores.toString();

        String prompt = String.format("""
                【玩家画像】%s
                【累计净积分】%d分
                【近3场走势】%s
                【完整战绩】%s
                【时间窗口】%s

                请根据以上数据，用赛博朋克+策略复盘的口吻生成今日策略。
                判词要像航电终端的冷静提示，可用时间窗口、节奏窗口、环境变量等意象映射到记录策略。
                """, tagDesc, netScore, trend, recentScores.toString(), timeContext);

        return prompt;
    }

    /**
     * 计算航段式时间窗口上下文。
     */
    private String getTimeWindowContext() {
        LocalDate today = LocalDate.now();
        int hour = LocalTime.now().getHour();
        String segment = hour < 6 ? "深夜低噪航段" : hour < 12 ? "晨间校准航段" : hour < 18 ? "日间巡航航段" : "夜间复盘航段";
        return today + "，" + segment;
    }

    /**
     * 解析 LLM 返回的 JSON
     */
    private FortuneResp parseLlmResponse(String content) {
        try {
            // 清理 markdown 代码块标记
            String json = content.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "");
            }
            // 提取第一个 { 到最后一个 } 之间的内容（应对 LLM 返回前缀文字的情况）
            int start = json.indexOf('{');
            int end = json.lastIndexOf('}');
            if (start >= 0 && end > start) {
                json = json.substring(start, end + 1);
            }
            log.info("LLM 原始返回: {}", content);
            JSONObject obj = JSONUtil.parseObj(json);
            JSONArray buffsArr = obj.getJSONArray("buffs");
            JSONArray debuffsArr = obj.getJSONArray("debuffs");
            FortuneResp resp = FortuneResp.builder()
                    .verdict(obj.getStr("verdict", "今日能量平稳"))
                    .buffs(buffsArr != null ? buffsArr.toList(String.class) : List.of("策略稳态", "节奏可控", "风险免疫"))
                    .debuffs(debuffsArr != null ? debuffsArr.toList(String.class) : List.of("情绪波动风险", "决策疲劳隐患"))
                    .glowColor(obj.getStr("themeColor", obj.getStr("glowColor", "#0A84FF")))
                    .tag(obj.getStr("tag", ""))
                    .source("llm")
                    .build();
            if (containsSensitiveWord(resp)) {
                throw new RuntimeException("LLM 响应命中敏感词");
            }
            return resp;
        } catch (Exception e) {
            log.warn("解析 LLM 响应失败: {}", content, e);
            throw new RuntimeException("LLM 响应解析失败", e);
        }
    }

    /**
     * 检查模型输出，命中敏感词时丢弃并走兜底策略。
     */
    private boolean containsSensitiveWord(FortuneResp resp) {
        String text = String.join(" ",
                Objects.toString(resp.getVerdict(), ""),
                String.join(" ", Optional.ofNullable(resp.getBuffs()).orElse(List.of())),
                String.join(" ", Optional.ofNullable(resp.getDebuffs()).orElse(List.of())),
                Objects.toString(resp.getTag(), "")
        );
        return SENSITIVE_WORDS.stream().anyMatch(text::contains);
    }

    /**
     * 兜底降级：从本地静态池随机抽取
     */
    private FortuneResp fallbackFortune(UserTag userTag) {
        List<FortuneResp> pool = FALLBACK_POOL.getOrDefault(userTag, FALLBACK_POOL.get(UserTag.STABLE));
        FortuneResp picked = pool.get(new Random().nextInt(pool.size()));
        return FortuneResp.builder()
                .verdict(picked.getVerdict())
                .buffs(picked.getBuffs())
                .debuffs(picked.getDebuffs())
                .glowColor(picked.getGlowColor())
                .tag(picked.getTag())
                .userTag(userTag.name())
                .source("fallback")
                .build();
    }

    /**
     * 根据 UserTag 从原型池中选取策略原型（基于当日日期作为种子保证当日一致）
     */
    private Archetype pickArchetype(UserTag userTag) {
        List<Archetype> pool = ARCHETYPE_POOL.getOrDefault(userTag, ARCHETYPE_POOL.get(UserTag.STABLE));
        int index = Math.floorMod(LocalDate.now().hashCode(), pool.size());
        return pool.get(index);
    }

    private static FortuneResp buildFallback(String verdict, List<String> buffs, List<String> debuffs, String glowColor, String tag) {
        return FortuneResp.builder()
                .verdict(verdict)
                .buffs(buffs)
                .debuffs(debuffs)
                .glowColor(glowColor)
                .tag(tag)
                .build();
    }

    /**
     * 填充时间窗口字段。
     */
    private void fillTimeWindowFields(FortuneResp resp) {
        try {
            LocalDate today = LocalDate.now();
            int hour = LocalTime.now().getHour();
            resp.setLunarDate(today.toString());
            resp.setSolarTerm(hour < 6 ? "LOW-NOISE" : hour < 12 ? "CALIBRATE" : hour < 18 ? "CRUISE" : "DEBRIEF");
        } catch (Exception e) {
            log.warn("计算时间窗口失败", e);
            resp.setLunarDate("");
            resp.setSolarTerm("");
        }
    }

    /**
     * 获取日期 key（用于缓存分区）
     */
    private String getDateKey() {
        return java.time.LocalDate.now().toString();
    }
}
