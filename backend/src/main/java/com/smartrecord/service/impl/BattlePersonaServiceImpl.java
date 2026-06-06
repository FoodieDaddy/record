package com.smartrecord.service.impl;

import com.smartrecord.dto.mirror.MirrorProfileResp.BattlePersonaInfo;
import com.smartrecord.dto.mirror.MirrorProfileResp.DimensionInfo;
import com.smartrecord.dto.mirror.MirrorProfileResp.ReadingInfo;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.service.BattlePersonaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BattlePersonaServiceImpl implements BattlePersonaService {

    private final RoomMemberMapper roomMemberMapper;

    private static final int MIN_SAMPLE = 3;
    private static final int MAX_SAMPLE = 10;

    private static final Map<String, PersonaMeta> PERSONA_MAP = Map.ofEntries(
            Map.entry("INSUFFICIENT_DATA", new PersonaMeta("样本不足", "当前封存样本不足，暂不生成稳定画像。")),
            Map.entry("STABLE_CONTROL", new PersonaMeta("稳健控场型", "打法偏向结构化执行，波动较低，擅长维持稳定节奏。")),
            Map.entry("AGGRESSIVE_PUSH", new PersonaMeta("主动推进型", "主动意愿强，数值窗口捕捉快，但需要控制连续试探风险。")),
            Map.entry("VOLATILE_BURST", new PersonaMeta("波动响应型", "单轮响应强，数值上限高，但整体波动和回撤风险偏大。")),
            Map.entry("DEFENSIVE_COUNTER", new PersonaMeta("防守反击型", "更擅长等待对手失误，适合低频决策和后手反击。")),
            Map.entry("SLOW_OBSERVER", new PersonaMeta("慢热观察型", "前期试探少，依赖信息积累，后段决策质量更稳定。")),
            Map.entry("EMOTIONAL_SWING", new PersonaMeta("情绪扰动型", "状态受连续正负反馈影响较明显，需要降低情绪化决策频率。"))
    );

    @Override
    public BattlePersonaResult calculate(Long userId) {
        // 查询最近 10 场净积分
        List<Map<String, Object>> trend = roomMemberMapper.selectTrendByUserId(userId, MAX_SAMPLE);
        List<Integer> netScores = new ArrayList<>();
        for (Map<String, Object> row : trend) {
            Object ns = row.get("netScore");
            if (ns instanceof Number) {
                netScores.add(((Number) ns).intValue());
            }
        }

        int sampleSize = netScores.size();

        // 样本不足
        if (sampleSize < MIN_SAMPLE) {
            BattlePersonaInfo persona = BattlePersonaInfo.builder()
                    .generated(false)
                    .sampleSize(sampleSize)
                    .sampleRange("recent" + MAX_SAMPLE)
                    .tag("INSUFFICIENT_DATA")
                    .title(PERSONA_MAP.get("INSUFFICIENT_DATA").title)
                    .summary(PERSONA_MAP.get("INSUFFICIENT_DATA").desc)
                    .calculatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))
                    .build();
            List<DimensionInfo> dims = buildDefaultDimensions();
            return new BattlePersonaResult(persona, dims);
        }

        // 计算四维度
        int stability = calcStability(netScores);
        int aggression = calcAggression(netScores);
        int drawdownControl = calcDrawdownControl(netScores);
        int volatilityRisk = calcVolatilityRisk(netScores);

        List<DimensionInfo> dimensions = List.of(
                DimensionInfo.builder().key("stability").label("稳定性").value(stability).desc("净数值波动越小，稳定性越高。").build(),
                DimensionInfo.builder().key("aggression").label("进攻性").value(aggression).desc("正向数值幅度和进攻窗口越明显，进攻性越高。").build(),
                DimensionInfo.builder().key("drawdownControl").label("回撤控制").value(drawdownControl).desc("最大回撤越小，回撤控制越高。").build(),
                DimensionInfo.builder().key("volatilityRisk").label("波动风险").value(volatilityRisk).desc("波动越大，风险值越高。").build()
        );

        // 判定人格标签
        String tag = determineTag(stability, aggression, drawdownControl, volatilityRisk);
        PersonaMeta meta = PERSONA_MAP.getOrDefault(tag, PERSONA_MAP.get("STABLE_CONTROL"));

        BattlePersonaInfo persona = BattlePersonaInfo.builder()
                .generated(true)
                .sampleSize(sampleSize)
                .sampleRange("recent" + MAX_SAMPLE)
                .tag(tag)
                .title(meta.title)
                .summary(meta.desc)
                .calculatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))
                .build();

        return new BattlePersonaResult(persona, dimensions);
    }

    @Override
    public ReadingInfo generateReading(String mbtiType, String personaTag) {
        boolean hasMbti = mbtiType != null && !mbtiType.isEmpty();
        boolean hasPersona = personaTag != null && !"INSUFFICIENT_DATA".equals(personaTag);

        if (hasMbti && hasPersona) {
            return generateCombinedStructuredReading(mbtiType, personaTag);
        }
        if (hasMbti) {
            String obs = "当前已完成人格校准，但任务样本不足。系统暂时只能基于 " + mbtiType
                    + " 生成初始倾向：你更适合规则清晰、节奏稳定的任务。完成 3 场封存后将补全任务判读。";
            return ReadingInfo.builder().available(true).text(obs)
                    .observation(obs).build();
        }
        if (hasPersona) {
            PersonaMeta meta = PERSONA_MAP.getOrDefault(personaTag, PERSONA_MAP.get("STABLE_CONTROL"));
            String obs = "当前判读基于历史任务生成，你的打法画像为「" + meta.title
                    + "」。完成 MBTI 校准后，系统可以进一步区分你的决策习惯与风险偏好。";
            return ReadingInfo.builder().available(true).text(obs)
                    .observation(obs).build();
        }
        String obs = "完成人格校准并积累至少 3 场封存后，系统将生成完整镜像画像。";
        return ReadingInfo.builder().available(true).text(obs).observation(obs).build();
    }

    // ---- 维度计算 ----

    private int calcStability(List<Integer> scores) {
        double stddev = stdDev(scores);
        // stddev=0 → 100, stddev>=100 → 0
        int val = (int) Math.round(100 - Math.min(stddev, 100));
        return clamp(val);
    }

    private int calcAggression(List<Integer> scores) {
        int positiveCount = 0;
        int maxGain = 0;
        int totalPositive = 0;
        for (int s : scores) {
            if (s > 0) {
                positiveCount++;
                totalPositive += s;
                maxGain = Math.max(maxGain, s);
            }
        }
        // 正向积分场次占比 (0-40分)
        double winRatio = (double) positiveCount / scores.size();
        int ratioScore = (int) Math.round(winRatio * 40);

        // 单场最大正向积分 (0-30分)
        int gainScore = (int) Math.round(Math.min(maxGain / 50.0, 1.0) * 30);

        // 近期动能：后半段平均 - 前半段平均 (0-30分)
        int half = scores.size() / 2;
        double firstHalf = avg(scores.subList(0, half));
        double secondHalf = avg(scores.subList(half, scores.size()));
        double momentum = secondHalf - firstHalf;
        int momentumScore = (int) Math.round(Math.min(Math.max(momentum + 30, 0) / 60.0, 1.0) * 30);

        return clamp(ratioScore + gainScore + momentumScore);
    }

    private int calcDrawdownControl(List<Integer> scores) {
        // 最大连续亏损
        int maxConsecutiveLoss = 0;
        int currentLoss = 0;
        int maxDrawdown = 0; // 最大单场亏损
        int cumulativeMin = 0;
        int cumulative = 0;

        for (int s : scores) {
            cumulative += s;
            cumulativeMin = Math.min(cumulativeMin, cumulative);
            maxDrawdown = Math.min(maxDrawdown, s);

            if (s < 0) {
                currentLoss++;
                maxConsecutiveLoss = Math.max(maxConsecutiveLoss, currentLoss);
            } else {
                currentLoss = 0;
            }
        }

        // 最大连续亏损越少越好 (0-50分)
        int consecutiveScore = (int) Math.round(Math.max(0, 1 - maxConsecutiveLoss / 5.0) * 50);

        // 最大单场亏损越小越好 (0-30分)
        int drawdownScore = (int) Math.round(Math.max(0, 1 - Math.abs(maxDrawdown) / 100.0) * 30);

        // 累计最大回撤 (0-20分)
        int cumulativeScore = (int) Math.round(Math.max(0, 1 - Math.abs(cumulativeMin) / 150.0) * 20);

        return clamp(consecutiveScore + drawdownScore + cumulativeScore);
    }

    private int calcVolatilityRisk(List<Integer> scores) {
        double stddev = stdDev(scores);
        int maxLoss = 0;
        int maxConsecutiveLoss = 0;
        int currentLoss = 0;

        for (int s : scores) {
            maxLoss = Math.min(maxLoss, s);
            if (s < 0) {
                currentLoss++;
                maxConsecutiveLoss = Math.max(maxConsecutiveLoss, currentLoss);
            } else {
                currentLoss = 0;
            }
        }

        // 标准差越高风险越高 (0-40分)
        int stddevScore = (int) Math.round(Math.min(stddev / 100.0, 1.0) * 40);

        // 最大负向积分越大风险越高 (0-30分)
        int lossScore = (int) Math.round(Math.min(Math.abs(maxLoss) / 100.0, 1.0) * 30);

        // 连续负反馈次数越多风险越高 (0-30分)
        int streakScore = (int) Math.round(Math.min(maxConsecutiveLoss / 5.0, 1.0) * 30);

        return clamp(stddevScore + lossScore + streakScore);
    }

    // ---- 人格标签判定 ----

    private String determineTag(int stability, int aggression, int drawdownControl, int volatilityRisk) {
        if (stability >= 70 && drawdownControl >= 65 && volatilityRisk <= 45) return "STABLE_CONTROL";
        if (aggression >= 70 && volatilityRisk <= 65) return "AGGRESSIVE_PUSH";
        if (aggression >= 65 && volatilityRisk >= 65) return "VOLATILE_BURST";
        if (drawdownControl >= 70 && aggression <= 50) return "DEFENSIVE_COUNTER";
        if (aggression <= 45 && stability >= 55) return "SLOW_OBSERVER";
        if (volatilityRisk >= 75) return "EMOTIONAL_SWING";
        return "STABLE_CONTROL";
    }

    // ---- 镜像判读组合文案（结构化） ----

    private ReadingInfo generateCombinedStructuredReading(String mbtiType, String personaTag) {
        String title = MbtiCalculator.getTypeTitle(mbtiType);
        PersonaMeta meta = PERSONA_MAP.getOrDefault(personaTag, PERSONA_MAP.get("STABLE_CONTROL"));
        boolean consistent = isConsistent(mbtiType, personaTag);

        String observation = "你的 " + mbtiType + " " + title + "倾向与当前" + meta.title + "画像"
                + (consistent ? "一致" : "形成互补视角") + "。";

        String deviation = consistent
                ? "理论人格与行为人格高度匹配，决策模式稳定。"
                : "理论人格与行为人格存在偏差，说明实战中你的决策风格可能与自我认知不同。";

        String risk = generateRiskText(personaTag);

        String growthAdvice = switch (personaTag) {
            case "STABLE_CONTROL" -> "保持低失误策略，但在连续优势局中提高主动性，避免错过进攻窗口。";
            case "AGGRESSIVE_PUSH" -> "设定单场暂停线，避免情绪化修正，在连续试探后主动降频。";
            case "VOLATILE_BURST" -> "在连续负反馈后主动降频，避免冲动决策，稳定节奏比瞬时强度更重要。";
            case "DEFENSIVE_COUNTER" -> "在信息充足时果断出手，避免因过度等待而错过短暂的进攻窗口。";
            case "SLOW_OBSERVER" -> "在开局阶段增加主动试探，避免前期被动导致后期追赶困难。";
            // 用户可见文案统一采用正负反馈语义，避免旧风格词直出。
            case "EMOTIONAL_SWING" -> "降低情绪化决策频率，在连续负反馈后暂停调整，避免连续修正心态。";
            default -> "保持稳定节奏，关注长期数值趋势。";
        };

        String text = observation + growthAdvice;

        return ReadingInfo.builder()
                .available(true)
                .text(text)
                .observation(observation)
                .deviation(deviation)
                .risk(risk)
                .growthAdvice(growthAdvice)
                .build();
    }

    private String generateRiskText(String personaTag) {
        return switch (personaTag) {
            case "STABLE_CONTROL" -> "进攻窗口出现时反应偏慢，可能错失良机。";
            case "AGGRESSIVE_PUSH" -> "连续试探可能放大回撤，需控制进攻频率。";
            // 用户可见文案统一采用回稳压力语义，避免旧风格词直出。
            case "VOLATILE_BURST" -> "波动偏大，状态不稳定，回稳压力较高。";
            case "DEFENSIVE_COUNTER" -> "过于被动可能导致错过短暂的进攻窗口。";
            case "SLOW_OBSERVER" -> "前期试探不足可能导致被动开局。";
            case "EMOTIONAL_SWING" -> "状态受连续正负反馈影响明显，情绪化决策风险高。";
            default -> "整体风险可控。";
        };
    }

    private boolean isConsistent(String mbtiType, String personaTag) {
        return switch (personaTag) {
            case "STABLE_CONTROL" -> Set.of("INTJ", "ISTJ", "ISFJ", "INFJ").contains(mbtiType);
            case "AGGRESSIVE_PUSH" -> Set.of("ENTJ", "ESTP", "ENTP").contains(mbtiType);
            case "VOLATILE_BURST" -> Set.of("ENTP", "ENFP", "ESFP").contains(mbtiType);
            case "DEFENSIVE_COUNTER" -> Set.of("ISTP", "INTP", "ISFP").contains(mbtiType);
            case "SLOW_OBSERVER" -> Set.of("INFP", "INTP", "ISFP", "INFJ").contains(mbtiType);
            case "EMOTIONAL_SWING" -> Set.of("ENFP", "ESFP", "INFP").contains(mbtiType);
            default -> false;
        };
    }

    // ---- 工具方法 ----

    private List<DimensionInfo> buildDefaultDimensions() {
        return List.of(
                DimensionInfo.builder().key("stability").label("稳定性").value(0).desc("净数值波动越小，稳定性越高。").build(),
                DimensionInfo.builder().key("aggression").label("进攻性").value(0).desc("正向数值幅度和进攻窗口越明显，进攻性越高。").build(),
                DimensionInfo.builder().key("drawdownControl").label("回撤控制").value(0).desc("最大回撤越小，回撤控制越高。").build(),
                DimensionInfo.builder().key("volatilityRisk").label("波动风险").value(0).desc("波动越大，风险值越高。").build()
        );
    }

    private double stdDev(List<Integer> values) {
        if (values.size() <= 1) return 0;
        double mean = avg(values);
        double sumSq = 0;
        for (int v : values) {
            sumSq += (v - mean) * (v - mean);
        }
        return Math.sqrt(sumSq / values.size());
    }

    private double avg(List<Integer> values) {
        if (values.isEmpty()) return 0;
        return values.stream().mapToInt(Integer::intValue).average().orElse(0);
    }

    private int clamp(int val) {
        return Math.max(0, Math.min(100, val));
    }

    private record PersonaMeta(String title, String desc) {}
}
