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

import com.nlf.calendar.Lunar;
import com.nlf.calendar.Solar;

import java.time.LocalDate;
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
            "棋牌", "赌博", "赌", "下注", "押注", "筹码", "牌局", "牌桌", "打牌", "麻将", "扑克",
            "德州", "梭哈", "赢钱", "赚钱", "发财", "稳赚", "必胜", "翻本", "追损", "运势",
            "算命", "占卜", "塔罗", "抽牌", "神谕", "卦象", "黄历", "风水", "开运", "转运",
            "改运", "预测输赢", "胜率提升", "ALL-IN"
    );

    /** LLM 系统提示词（常量，供日志记录复用） */
    private static final String SYSTEM_PROMPT = """
            你是存在于赛博朋克世界的"策略状态推演引擎"，为即将进入多人积分场景的用户生成今日专属"策略状态快照"。

            【创作基调】
            1. 绝对禁止枯燥的IT运维词汇（负载均衡、算法优化、数据溢出、网络延迟）
            2. 绝对禁止传统玄学词汇（大吉、宜忌、破财、诸事不宜）
            3. 必须将中国农历/节气意象与赛博科幻词汇结合，映射到玩家真实的对局痛点（随机反馈、情绪波动、逻辑推理、节奏管理）
            4. 禁止预测结果、做任何利益承诺、鼓励冒进，输出必须是复盘建议、状态管理、节奏提醒、风险控制。
            5. 禁止触碰审核敏感主题，包括博彩、传统玄学、利益承诺、结果预测相关表述。

            【字段规范】
            tag：4字短语，极具张力。正面示例：绝对理智、冷静主宰、算力超频、维度碾压。负面示例：算力枯竭、状态漂移、磁场紊乱、情绪过载。
            verdict：10-18字，像高维生物对玩家的冷酷忠告，必须巧妙融合当天农历/节气意象。示例：芒种火旺引发随机数暴走，切忌越级对抗。
            buffs：恰好3个元素，每个5-7字，描述多人积分场景中的策略优势。示例库：随机反馈免疫、逻辑推演无盲区、情绪防火墙坚固、微表情捕捉满载、逆境校准能力强。
            debuffs：恰好2个元素，每个5-7字，描述对局中的隐患。示例库：容易被连续小分激怒、随机数波动敏感、中盘决策疲劳、防守反击容易漏判。

            只输出一个JSON对象，不要markdown代码块，不要任何其他文字：
            {"themeColor":"#HEX","tag":"4字","verdict":"10-18字","buffs":["增益1","增益2","增益3"],"debuffs":["预警1","预警2"]}
            颜色规则：稳健=#0A84FF 连胜=#32D74B 连败=#FF9F0A 高波动=#FF453A
            """;

    // ===== 兜底静态策略池 =====

    /** 卡牌原型 */
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

    /** 卡牌原型池：UserTag → 可选原型列表 */
    private static final Map<UserTag, List<Archetype>> ARCHETYPE_POOL = new EnumMap<>(UserTag.class);

    private static final Map<UserTag, List<FortuneResp>> FALLBACK_POOL = new EnumMap<>(UserTag.class);

    static {
        FALLBACK_POOL.put(UserTag.WINNING_STREAK, List.of(
                buildFallback("气场如虹，连胜势能持续扩散",
                        List.of("连胜势能加持", "心态稳定输出", "决策果断精准"),
                        List.of("注意骄傲轻敌", "避免贪心冒进"),
                        "#32D74B", "理智"),
                buildFallback("今日状态极佳，判断与节奏共振",
                        List.of("手感火热沸腾", "节奏感强烈", "专注力全程在线"),
                        List.of("避免贪心冒进", "留意对手反扑"),
                        "#32D74B", "狂热"),
                buildFallback("高维能量涌动，主动节奏环绕",
                        List.of("势不可挡碾压", "信心爆棚满溢", "直觉敏锐如刀"),
                        List.of("留意对手反扑", "保持谦逊心态"),
                        "#32D74B", "碾压")
        ));

        FALLBACK_POOL.put(UserTag.LOSING_STREAK, List.of(
                buildFallback("低谷是蓄力的过程，静待反弹",
                        List.of("触底反弹势能", "心态沉淀内敛", "经验持续积累"),
                        List.of("避免情绪化计分", "注意休息调整"),
                        "#FF9F0A", "蓄力"),
                buildFallback("今日适合观察与复盘，不宜激进",
                        List.of("洞察力大幅增强", "冷静分析局势", "复盘经验沉淀"),
                        List.of("连败惯性未消散", "控制投入节奏"),
                        "#FF6B35", "潜伏"),
                buildFallback("阴霾终将散去，保持节奏即可",
                        List.of("韧性被动加成", "逆境快速成长", "隐忍蓄势待发"),
                        List.of("切勿急于修正", "避免高风险操作"),
                        "#FF453A", "蛰伏")
        ));

        FALLBACK_POOL.put(UserTag.HIGH_RISK, List.of(
                buildFallback("波动即机遇，关键在于时机把控",
                        List.of("高波动校准力", "爆发力惊人强劲", "时机嗅觉敏锐"),
                        List.of("风险敞口较大", "情绪波动影响判断"),
                        "#FF2D55", "狂野"),
                buildFallback("今日能量起伏剧烈，建议稳健为主",
                        List.of("关键时刻爆发", "直觉灵敏如电", "极限操作潜力"),
                        List.of("结果波动较高", "需严格控制节奏"),
                        "#AF52DE", "过载"),
                buildFallback("极端行情下，纪律是最好的护身符",
                        List.of("极端情境适应力", "抗压能力超群", "逆境回稳能力"),
                        List.of("避免冒进心态", "务必设置暂停线"),
                        "#FF375F", "失控")
        ));

        FALLBACK_POOL.put(UserTag.STABLE, List.of(
                buildFallback("平稳是最好的基底，细水长流",
                        List.of("心态平稳如水", "节奏稳定输出", "持续高效作战"),
                        List.of("缺乏爆发力", "注意抓住转瞬机会"),
                        "#0A84FF", "稳健"),
                buildFallback("今日无明显波动，正常发挥即可",
                        List.of("稳定发挥水准", "不易犯低级错"),
                        List.of("可能错过风口", "需要主动出击"),
                        "#0A84FF", "均衡"),
                buildFallback("静水深流，稳健型选手的舒适区",
                        List.of("风险控制出色", "长期节奏稳定", "心态韧性十足"),
                        List.of("短期爆发不足", "需要适当冒险"),
                        "#0A84FF", "巡航")
        ));

        ARCHETYPE_POOL.put(UserTag.WINNING_STREAK, List.of(
                new Archetype("压制者", "THE DOMINATOR", List.of("强势", "连续", "压制")),
                new Archetype("开拓者", "THE PIONEER", List.of("主动", "突破", "先手")),
                new Archetype("决策者", "THE DECIDER", List.of("果断", "清晰", "执行"))
        ));
        ARCHETYPE_POOL.put(UserTag.LOSING_STREAK, List.of(
                new Archetype("蛰伏者", "THE WATCHER", List.of("隐忍", "积累", "时机")),
                new Archetype("观察者", "THE OBSERVER", List.of("耐心", "分析", "等待")),
                new Archetype("引路者", "THE GUIDE", List.of("引导", "顺势", "直觉"))
        ));
        ARCHETYPE_POOL.put(UserTag.HIGH_RISK, List.of(
                new Archetype("破局者", "THE BREAKER", List.of("冒险", "反转", "大胆")),
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
                if (resp.getLunarDate() == null) fillLunarFields(resp);
                // 缓存命中时补充卡牌原型（缓存中可能没有）
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

        // 2.5 填充卡牌原型
        Archetype archetype = pickArchetype(userTag);
        result.setTitle(archetype.title);
        result.setSubtitle(archetype.subtitle);
        result.setTags(archetype.keywords);

        // 3. 填充农历/节气字段
        fillLunarFields(result);

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
     * 调用 OpenAI 兼容 LLM API
     */
    private FortuneResp callLlm(UserTag userTag, int netScore, List<Integer> recentScores, LlmCallContext ctx) {
        String prompt = buildPrompt(userTag, netScore, recentScores);
        ctx.prompt = prompt;

        JSONObject requestBody = new JSONObject();
        requestBody.set("model", model);
        requestBody.set("temperature", 0.6);
        requestBody.set("max_tokens", 512);
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
        JSONObject message = respJson.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message");
        String content = message.getStr("content");

        // MiMo 可能将内容放在 reasoning_content 中
        if (content == null || content.isBlank()) {
            content = message.getStr("reasoning_content");
        }
        if (content == null || content.isBlank()) {
            throw new RuntimeException("LLM 返回空内容");
        }

        return parseLlmResponse(content);
    }

    /**
     * 构建 LLM Prompt
     */
    private String buildPrompt(UserTag userTag, int netScore, List<Integer> recentScores) {
        String tagDesc = switch (userTag) {
            case WINNING_STREAK -> "近期连胜，状态高昂，手感火热";
            case LOSING_STREAK -> "近期连败，状态低迷，心态受挫";
            case HIGH_RISK -> "高波动型，节奏起伏明显";
            case STABLE -> "稳健型，表现平稳，不温不火";
        };

        String lunarContext = getLunarContext();

        String trend = recentScores.size() >= 3
                ? recentScores.subList(recentScores.size() - 3, recentScores.size()).toString()
                : recentScores.toString();

        String prompt = String.format("""
                【玩家画像】%s
                【累计净积分】%d分
                【近3场走势】%s
                【完整战绩】%s
                【时空坐标】%s

                请根据以上数据，结合当天农历/节气的自然意象，用赛博朋克+策略复盘的口吻生成今日策略。
                判词要像高维生物的冷酷忠告，必须引用节气/农历意象并映射到对局策略。
                """, tagDesc, netScore, trend, recentScores.toString(), lunarContext);

        return prompt;
    }

    /**
     * 计算农历/天干地支/节气时空上下文
     */
    private String getLunarContext() {
        LocalDate today = LocalDate.now();
        Solar solar = Solar.fromYmd(today.getYear(), today.getMonthValue(), today.getDayOfMonth());
        Lunar lunar = solar.getLunar();

        String yearGanZhi = lunar.getYearInGanZhi();       // 天干地支年，如"丙午"
        String lunarMonth = lunar.getMonthInChinese();     // 农历月，如"五"
        String lunarDay = lunar.getDayInChinese();         // 农历日，如"初九"
        var jieQi = lunar.getCurrentJieQi();               // 当前节气，无则返回 null

        String lunarDesc = yearGanZhi + "年 农历" + lunarMonth + "月" + lunarDay;
        if (jieQi != null) {
            lunarDesc += "，节气：" + jieQi.getName();
        }
        return lunarDesc;
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
            FortuneResp resp = FortuneResp.builder()
                    .verdict(obj.getStr("verdict", "今日能量平稳"))
                    .buffs(obj.getJSONArray("buffs").toList(String.class))
                    .debuffs(obj.getJSONArray("debuffs").toList(String.class))
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
     * 根据 UserTag 从原型池中选取卡牌（基于当日日期作为种子保证当日一致）
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
     * 填充农历日期和节气字段
     */
    private void fillLunarFields(FortuneResp resp) {
        try {
            LocalDate today = LocalDate.now();
            Solar solar = Solar.fromYmd(today.getYear(), today.getMonthValue(), today.getDayOfMonth());
            Lunar lunar = solar.getLunar();

            String yearGanZhi = lunar.getYearInGanZhi();
            String month = lunar.getMonthInChinese();
            String day = lunar.getDayInChinese();
            resp.setLunarDate(yearGanZhi + "年" + month + "月" + day);

            var jieQi = lunar.getCurrentJieQi();
            resp.setSolarTerm(jieQi != null ? jieQi.getName() : "");
        } catch (Exception e) {
            log.warn("计算农历信息失败", e);
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
