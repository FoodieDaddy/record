package com.smartrecord.service.impl;

import cn.hutool.http.Header;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smartrecord.dto.fortune.FortuneResp;
import com.smartrecord.dto.fortune.UserTag;
import com.smartrecord.mapper.ScoreMapper;
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

    private final ScoreMapper scoreMapper;
    private final Executor asyncExecutor;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.llm.api-url:}")
    private String apiUrl;

    @Value("${app.llm.api-key:}")
    private String apiKey;

    @Value("${app.llm.model:deepseek-chat}")
    private String model;

    /** 每日运势 Redis 缓存 key */
    private static final String FORTUNE_CACHE_KEY = "sr:fortune:";
    private static final long CACHE_TTL_HOURS = 4;

    // ===== 兜底静态运势池 =====

    private static final Map<UserTag, List<FortuneResp>> FALLBACK_POOL = new EnumMap<>(UserTag.class);

    static {
        FALLBACK_POOL.put(UserTag.WINNING_STREAK, List.of(
                buildFallback("气场如虹，连胜势能持续扩散",
                        List.of("连胜势能加持", "心态稳定输出", "决策果断精准"),
                        List.of("注意骄傲轻敌", "避免贪心冒进"),
                        "#32D74B", "天命"),
                buildFallback("今日状态极佳，运气与实力共振",
                        List.of("手感火热沸腾", "节奏感强烈", "专注力全程在线"),
                        List.of("避免贪心冒进", "留意对手反扑"),
                        "#32D74B", "狂热"),
                buildFallback("高维能量涌动，胜利磁场环绕",
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
                        List.of("切勿急于翻本", "避免高风险操作"),
                        "#FF453A", "蛰伏")
        ));

        FALLBACK_POOL.put(UserTag.HIGH_RISK, List.of(
                buildFallback("波动即机遇，关键在于时机把控",
                        List.of("高波动收益潜力", "爆发力惊人强劲", "时机嗅觉敏锐"),
                        List.of("风险敞口较大", "情绪波动影响判断"),
                        "#FF2D55", "狂野"),
                buildFallback("今日能量起伏剧烈，建议稳健为主",
                        List.of("关键时刻爆发", "直觉灵敏如电", "极限操作潜力"),
                        List.of("大输大赢概率高", "需严格控制仓位"),
                        "#AF52DE", "过载"),
                buildFallback("极端行情下，纪律是最好的护身符",
                        List.of("极端情境适应力", "抗压能力超群", "逆风翻盘体质"),
                        List.of("避免ALL-IN心态", "务必设置止损线"),
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
                        List.of("风险控制出色", "长期收益稳定", "心态韧性十足"),
                        List.of("短期爆发不足", "需要适当冒险"),
                        "#0A84FF", "巡航")
        ));
    }

    @Override
    public FortuneResp getTodayFortune(Long userId, boolean force) {
        // 0. 检查 Redis 缓存（每日运势 4 小时内复用，force 时跳过）
        String cacheKey = FORTUNE_CACHE_KEY + userId + ":" + getDateKey();
        if (!force) {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("命中每日运势缓存: userId={}", userId);
                FortuneResp resp = JSONUtil.parseObj(cached).toBean(FortuneResp.class);
                if (resp.getLunarDate() == null) fillLunarFields(resp);
                return resp;
            }
        } else {
            log.info("强制刷新运势: userId={}", userId);
            redisTemplate.delete(cacheKey);
        }

        // 1. 计算用户画像标签
        List<Integer> recentScores = scoreMapper.selectRecentScores(userId, 10);
        UserTag userTag = computeUserTag(recentScores);
        int netScore = recentScores.stream().mapToInt(Integer::intValue).sum();

        // 2. CompletableFuture 双引擎：LLM 主引擎 + 兜底
        FortuneResp result;
        boolean fromLlm = false;

        if (apiUrl != null && !apiUrl.isEmpty() && apiKey != null && !apiKey.isEmpty()) {
            try {
                FortuneResp llmResult = CompletableFuture
                        .supplyAsync(() -> callLlm(userTag, netScore, recentScores), asyncExecutor)
                        .orTimeout(60000, TimeUnit.MILLISECONDS)
                        .exceptionally(ex -> {
                            log.warn("LLM 调用超时/异常，降级到兜底: {}", ex.getMessage());
                            return fallbackFortune(userTag);
                        })
                        .join();
                result = llmResult;
                fromLlm = "llm".equals(llmResult.getSource());
            } catch (Exception e) {
                log.warn("CompletableFuture 异常，降级到兜底: {}", e.getMessage());
                result = fallbackFortune(userTag);
            }
        } else {
            log.info("LLM 未配置，直接使用兜底运势");
            result = fallbackFortune(userTag);
        }

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
            log.warn("缓存运势失败: userId={}", userId, e);
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
    private FortuneResp callLlm(UserTag userTag, int netScore, List<Integer> recentScores) {
        String prompt = buildPrompt(userTag, netScore, recentScores);

        JSONObject requestBody = new JSONObject();
        requestBody.set("model", model);
        requestBody.set("temperature", 0.6);
        requestBody.set("max_tokens", 8192);
        requestBody.set("include_reasoning", false);

        JSONArray messages = new JSONArray();
        JSONObject systemMsg = new JSONObject();
        systemMsg.set("role", "system");
        systemMsg.set("content", """
                赛博运势AI引擎。根据战绩数据生成运势JSON。
                禁止传统黄历词汇。使用电竞/科幻黑话。
                只输出一个JSON对象，不要markdown代码块，不要任何其他文字：
                {"themeColor":"#HEX","tag":"2-4字","verdict":"10-18字判词","buffs":["增益1","增益2","增益3"],"debuffs":["预警1","预警2"]}
                严格要求：buffs恰好3个元素，debuffs恰好2个元素，每个元素4-6个字。
                颜色规则：稳健=#0A84FF 连胜=#32D74B 连败=#FF9F0A 高波动=#FF453A
                """);
        messages.add(systemMsg);

        JSONObject userMsg = new JSONObject();
        userMsg.set("role", "user");
        userMsg.set("content", prompt);
        messages.add(userMsg);
        requestBody.set("messages", messages);

        HttpResponse response = HttpRequest.post(apiUrl)
                .header(Header.AUTHORIZATION, "Bearer " + apiKey)
                .header(Header.CONTENT_TYPE, "application/json")
                .body(requestBody.toString())
                .timeout(60000)
                .execute();

        if (!response.isOk()) {
            log.warn("LLM API 返回非 200: status={}, body={}", response.getStatus(), response.body());
            throw new RuntimeException("LLM API error: " + response.getStatus());
        }

        log.info("LLM API 响应体: {}", response.body());
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
            case WINNING_STREAK -> "近期连胜，状态高昂";
            case LOSING_STREAK -> "近期连败，状态低迷";
            case HIGH_RISK -> "大输大赢型，波动剧烈";
            case STABLE -> "稳健型，表现平稳";
        };

        String lunarContext = getLunarContext();

        return String.format("""
                画像：%s | 净积分：%d | 各场得分：%s | 农历：%s
                判词中融入干支/节气意象，保持科幻黑话语境。直接输出JSON。
                """, tagDesc, netScore, recentScores.toString(), lunarContext);
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
            return FortuneResp.builder()
                    .verdict(obj.getStr("verdict", "今日能量平稳"))
                    .buffs(obj.getJSONArray("buffs").toList(String.class))
                    .debuffs(obj.getJSONArray("debuffs").toList(String.class))
                    .glowColor(obj.getStr("themeColor", obj.getStr("glowColor", "#0A84FF")))
                    .tag(obj.getStr("tag", ""))
                    .source("llm")
                    .build();
        } catch (Exception e) {
            log.warn("解析 LLM 响应失败: {}", content, e);
            throw new RuntimeException("LLM 响应解析失败", e);
        }
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
