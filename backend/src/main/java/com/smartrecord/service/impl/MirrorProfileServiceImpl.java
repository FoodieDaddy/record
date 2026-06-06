package com.smartrecord.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartrecord.common.BizException;
import com.smartrecord.dto.mirror.MbtiTestReq;
import com.smartrecord.dto.mirror.MirrorProfileResp;
import com.smartrecord.dto.mirror.MirrorProfileResp.*;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.enums.MbtiType;
import com.smartrecord.mapper.UserMirrorProfileMapper;
import com.smartrecord.service.BattlePersonaService;
import com.smartrecord.service.MirrorProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorProfileServiceImpl implements MirrorProfileService {

    private final UserMirrorProfileMapper profileMapper;
    private final BattlePersonaService battlePersonaService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String CACHE_KEY = "sr:mirror:profile:";
    private static final long CACHE_TTL_MINUTES = 30;

    /** MBTI 认知特征标签 */
    private static final Map<String, List<String>> MBTI_TRAITS = Map.ofEntries(
            Map.entry("INTJ", List.of("战略思维", "长期主义", "独立决策", "风险克制")),
            Map.entry("INTP", List.of("模式识别", "逻辑推演", "灵活变通", "深度分析")),
            Map.entry("ENTJ", List.of("节奏主导", "稳压决策", "目标驱动", "结构化执行")),
            Map.entry("ENTP", List.of("机会捕捉", "多线程思维", "扰动试探", "快速切换")),
            Map.entry("INFJ", List.of("远距阅读", "模式感知", "隐性节奏", "直觉判断")),
            Map.entry("INFP", List.of("价值驱动", "低频高质", "模式识别", "原则坚守")),
            Map.entry("ENFJ", List.of("节奏组织", "协同驱动", "情绪感知", "团队节奏")),
            Map.entry("ENFP", List.of("机会游走", "高频切换", "情绪带动", "灵活应变")),
            Map.entry("ISTJ", List.of("纪律执行", "稳定节奏", "规则遵循", "低失误率")),
            Map.entry("ISFJ", List.of("边界稳固", "稳定输出", "风险规避", "持久耐力")),
            Map.entry("ESTJ", List.of("规则控场", "节奏控制", "稳压执行", "结构化打法")),
            Map.entry("ESFJ", List.of("协同支援", "团队配合", "节奏感知", "稳定贡献")),
            Map.entry("ISTP", List.of("冷启动分析", "精准出手", "独立决策", "效率优先")),
            Map.entry("ISFP", List.of("低频感知", "直觉捕捉", "柔韧应变", "安静观察")),
            Map.entry("ESTP", List.of("高频响应", "即时反应", "快速决策", "窗口执行")),
            Map.entry("ESFP", List.of("现场响应", "即时反应", "高频决策", "情绪感知"))
    );

    /** MBTI → 中文称号 */
    private static final Map<String, String> MBTI_TITLES = Map.ofEntries(
            Map.entry("INTJ", "冷静型控场者"),
            Map.entry("INTP", "模型型分析者"),
            Map.entry("ENTJ", "主导型指挥者"),
            Map.entry("ENTP", "扰动型试探者"),
            Map.entry("INFJ", "远读型观察者"),
            Map.entry("INFP", "直觉型守序者"),
            Map.entry("ENFJ", "节奏型组织者"),
            Map.entry("ENFP", "机会型游走者"),
            Map.entry("ISTJ", "纪律型执行者"),
            Map.entry("ISFJ", "防守型稳定者"),
            Map.entry("ESTJ", "规则型控场者"),
            Map.entry("ESFJ", "协同型支援者"),
            Map.entry("ISTP", "冷启动分析者"),
            Map.entry("ISFP", "低频型感知者"),
            Map.entry("ESTP", "高频型响应者"),
            Map.entry("ESFP", "现场型响应者")
    );

    /** MBTI → 人格预测倾向描述 */
    private static final Map<String, String> MBTI_PREDICTION = Map.ofEntries(
            Map.entry("INTJ", "偏控场"),
            Map.entry("INTP", "偏防守"),
            Map.entry("ENTJ", "偏进攻"),
            Map.entry("ENTP", "偏扰动"),
            Map.entry("INFJ", "偏观察"),
            Map.entry("INFP", "偏防守"),
            Map.entry("ENFJ", "偏控场"),
            Map.entry("ENFP", "偏波动"),
            Map.entry("ISTJ", "偏稳健"),
            Map.entry("ISFJ", "偏防守"),
            Map.entry("ESTJ", "偏控场"),
            Map.entry("ESFJ", "偏协同"),
            Map.entry("ISTP", "偏防守"),
            Map.entry("ISFP", "偏观察"),
            Map.entry("ESTP", "偏进攻"),
            Map.entry("ESFP", "偏波动")
    );

    @Override
    public MirrorProfileResp getFullProfile(Long userId) {
        // 尝试读缓存
        String cacheKey = CACHE_KEY + userId;
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, MirrorProfileResp.class);
            }
        } catch (Exception e) {
            log.warn("读取镜像缓存失败: userId={}", userId);
        }

        // 构建完整画像
        UserMirrorProfile profile = getProfile(userId);
        ProfileInfo mbti = toProfileInfo(profile);

        // 计算战绩画像
        BattlePersonaService.BattlePersonaResult personaResult = battlePersonaService.calculate(userId);
        BattlePersonaInfo battlePersona = personaResult.persona();

        // 持久化画像到数据库
        savePersonaToProfile(userId, battlePersona);

        // 生成判读
        String mbtiTypeStr = profile != null && profile.getMbtiCode() != null
                ? MbtiType.fromCode(profile.getMbtiCode()).map(MbtiType::getType).orElse(null)
                : null;
        ReadingInfo reading = battlePersonaService.generateReading(
                mbtiTypeStr,
                battlePersona.getTag());

        // 认知特征标签
        List<String> traits = (mbtiTypeStr != null)
                ? MBTI_TRAITS.getOrDefault(mbtiTypeStr, List.of())
                : List.of();

        // 人格与战绩匹配度
        PersonaMatchInfo personaMatch = computePersonaMatch(
                mbtiTypeStr, battlePersona, personaResult.dimensions());

        // 计算人格可信度
        boolean mbtiCalibrated = mbti != null && mbti.isCalibrated();
        boolean personaGenerated = battlePersona != null && battlePersona.isGenerated();
        int sampleSize = battlePersona != null ? battlePersona.getSampleSize() : 0;
        int personaConfidence = (mbtiCalibrated ? 25 : 0)
                + Math.min(sampleSize * 8, 25)
                + (personaGenerated ? 25 : 0)
                + (mbtiCalibrated ? 25 : 0);
        personaConfidence = Math.min(personaConfidence, 100);

        MirrorProfileResp resp = MirrorProfileResp.builder()
                .mbti(mbti)
                .battlePersona(battlePersona)
                .dimensions(personaResult.dimensions())
                .reading(reading)
                .traits(traits)
                .personaMatch(personaMatch)
                .personaConfidence(personaConfidence)
                .build();

        // 写缓存
        try {
            redisTemplate.opsForValue().set(cacheKey,
                    objectMapper.writeValueAsString(resp),
                    CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (JsonProcessingException e) {
            log.warn("序列化镜像缓存失败: userId={}", userId);
        } catch (Exception e) {
            log.warn("写入镜像缓存失败: userId={}", userId);
        }

        return resp;
    }

    @Override
    public ProfileInfo submitMbtiTest(Long userId, MbtiTestReq req) {
        if (req.getAnswers() == null || req.getAnswers().size() != 20) {
            throw new BizException("必须提交20题答案");
        }

        MbtiCalculator.Result result = MbtiCalculator.calculate(req.getAnswers());

        UserMirrorProfile profile = new UserMirrorProfile();
        profile.setUserId(userId);
        profile.setMbtiCode(result.code());
        profile.setMbtiSource("test");
        profile.setMbtiConfidence(BigDecimal.valueOf(result.confidence()));
        profile.setMbtiTestVersion(req.getTestVersion());
        profile.setMbtiAnswersJson(java.util.List.copyOf(
                req.getAnswers().stream().map(a -> (Object) a).toList()));
        profile.setCalibratedAt(LocalDateTime.now());

        saveProfile(profile);
        clearProfileCache(userId);
        return toProfileInfo(profile);
    }

    @Override
    public ProfileInfo submitMbtiDirect(Long userId, int mbtiCode) {
        if (!MbtiType.isValidCode(mbtiCode)) {
            throw new BizException("非法MBTI类型编号: " + mbtiCode);
        }

        UserMirrorProfile profile = new UserMirrorProfile();
        profile.setUserId(userId);
        profile.setMbtiCode(mbtiCode);
        profile.setMbtiSource("direct");
        profile.setMbtiConfidence(BigDecimal.valueOf(100));
        profile.setCalibratedAt(LocalDateTime.now());

        saveProfile(profile);
        clearProfileCache(userId);
        return toProfileInfo(profile);
    }

    @Override
    public UserMirrorProfile getProfile(Long userId) {
        return profileMapper.selectById(userId);
    }

    @Override
    public ProfileInfo toProfileInfo(Long userId) {
        UserMirrorProfile profile = getProfile(userId);
        return toProfileInfo(profile);
    }

    @Override
    public void clearProfileCache(Long userId) {
        try {
            redisTemplate.delete(CACHE_KEY + userId);
        } catch (Exception e) {
            log.warn("清除镜像缓存失败: userId={}", userId);
        }
    }

    // ---- 内部方法 ----

    private ProfileInfo toProfileInfo(UserMirrorProfile p) {
        if (p == null) {
            return ProfileInfo.builder().calibrated(false).build();
        }
        return ProfileInfo.builder()
                .calibrated(p.getMbtiCode() != null && p.getMbtiCode() > 0)
                .mbtiCode(p.getMbtiCode())
                .confidence(p.getMbtiConfidence())
                .mbtiSource(p.getMbtiSource())
                .calibratedAt(p.getCalibratedAt() != null
                        ? p.getCalibratedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                        : null)
                .build();
    }

    /**
     * 计算人格与战绩匹配度
     * 对比 MBTI 预测的维度倾向 vs 实际雷达维度分值
     */
    private PersonaMatchInfo computePersonaMatch(String mbtiType,
                                                  BattlePersonaInfo battlePersona,
                                                  List<DimensionInfo> dimensions) {
        if (mbtiType == null || mbtiType.isEmpty() || !battlePersona.isGenerated()) {
            return PersonaMatchInfo.builder().available(false).build();
        }

        // MBTI 预测的维度倾向 (stability, aggression, drawdownControl, volatilityRisk)
        // 值表示该 MBTI 类型在这维度上的预期高低（0-100 基准）
        Map<String, int[]> predictedMap = Map.ofEntries(
                // 稳健控场型
                Map.entry("INTJ", new int[]{85, 40, 85, 25}),
                Map.entry("ISTJ", new int[]{90, 35, 90, 20}),
                Map.entry("ISFJ", new int[]{85, 30, 85, 20}),
                Map.entry("INFJ", new int[]{80, 35, 80, 30}),
                Map.entry("ESTJ", new int[]{80, 55, 75, 30}),
                Map.entry("ENFJ", new int[]{75, 50, 70, 35}),
                // 高压进攻型
                Map.entry("ENTJ", new int[]{60, 80, 55, 45}),
                Map.entry("ESTP", new int[]{45, 85, 40, 55}),
                // 波动响应型
                Map.entry("ENTP", new int[]{40, 75, 35, 70}),
                Map.entry("ENFP", new int[]{35, 70, 35, 70}),
                Map.entry("ESFP", new int[]{30, 75, 30, 75}),
                // 防守反击型
                Map.entry("ISTP", new int[]{70, 35, 75, 30}),
                Map.entry("INTP", new int[]{65, 30, 70, 35}),
                Map.entry("ISFP", new int[]{65, 30, 70, 35}),
                // 慢热观察型
                Map.entry("INFP", new int[]{70, 25, 65, 30})
        );

        int[] predicted = predictedMap.getOrDefault(mbtiType, new int[]{50, 50, 50, 50});

        // 提取实际维度值
        Map<String, Integer> actualMap = new HashMap<>();
        for (DimensionInfo d : dimensions) {
            actualMap.put(d.getKey(), d.getValue());
        }
        int actualStability = actualMap.getOrDefault("stability", 0);
        int actualAggression = actualMap.getOrDefault("aggression", 0);
        int actualDrawdown = actualMap.getOrDefault("drawdownControl", 0);
        int actualVolatility = actualMap.getOrDefault("volatilityRisk", 0);

        // 计算各维度匹配度（差距越小匹配越高）
        int matchS = 100 - Math.abs(actualStability - predicted[0]) * 2;
        int matchA = 100 - Math.abs(actualAggression - predicted[1]) * 2;
        int matchD = 100 - Math.abs(actualDrawdown - predicted[2]) * 2;
        int matchV = 100 - Math.abs(actualVolatility - predicted[3]) * 2;

        int overall = Math.max(0, Math.min(100,
                (matchS * 3 + matchA * 3 + matchD * 2 + matchV * 2) / 10));

        // 预测倾向
        String prediction = MBTI_PREDICTION.getOrDefault(mbtiType, "均衡型");

        // 实际表现摘要
        String actualSummary = String.format("控场力 %d / 稳定性 %d / 进攻性 %d",
                actualMap.getOrDefault("dominance", actualDrawdown),
                actualStability, actualAggression);

        // 总结
        String summary;
        if (overall >= 80) {
            summary = "人格预测与实际表现高度一致";
        } else if (overall >= 60) {
            summary = "人格预测与实际表现基本吻合";
        } else {
            summary = "人格预测与实际表现存在差异，打法可能更灵活";
        }

        // 反推MBTI：根据实际雷达维度找最近邻
        int[] actualVec = {actualStability, actualAggression, actualDrawdown, actualVolatility};
        String inferredMbti = null;
        double minDist = Double.MAX_VALUE;
        for (var entry : predictedMap.entrySet()) {
            double dist = euclideanDist(actualVec, entry.getValue());
            if (dist < minDist) {
                minDist = dist;
                inferredMbti = entry.getKey();
            }
        }
        String inferredMbtiType = inferredMbti;
        String inferredMbtiTitle = inferredMbti != null ? MBTI_TITLES.getOrDefault(inferredMbti, "") : "";
        int deviationPercent = 100 - overall;

        return PersonaMatchInfo.builder()
                .available(true)
                .matchPercentage(overall)
                .prediction(prediction)
                .actualSummary(actualSummary)
                .summary(summary)
                .inferredMbtiType(inferredMbtiType)
                .inferredMbtiTitle(inferredMbtiTitle)
                .deviationPercent(deviationPercent)
                .build();
    }

    private static double euclideanDist(int[] a, int[] b) {
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            double diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    private void saveProfile(UserMirrorProfile profile) {
        UserMirrorProfile existing = profileMapper.selectById(profile.getUserId());
        if (existing != null) {
            profileMapper.updateById(profile);
        } else {
            profileMapper.insert(profile);
        }
        log.info("MBTI已保存: userId={}, code={}, source={}",
                profile.getUserId(), profile.getMbtiCode(), profile.getMbtiSource());
    }

    private void savePersonaToProfile(Long userId, BattlePersonaInfo persona) {
        UserMirrorProfile existing = profileMapper.selectById(userId);
        if (existing == null) {
            UserMirrorProfile p = new UserMirrorProfile();
            p.setUserId(userId);
            p.setBattlePersonaTag(persona.getTag());
            p.setBattlePersonaTitle(persona.getTitle());
            p.setBattlePersonaSummary(persona.getSummary());
            p.setSampleSize(persona.getSampleSize());
            p.setPersonaCalculatedAt(LocalDateTime.now());
            profileMapper.insert(p);
        } else {
            existing.setBattlePersonaTag(persona.getTag());
            existing.setBattlePersonaTitle(persona.getTitle());
            existing.setBattlePersonaSummary(persona.getSummary());
            existing.setSampleSize(persona.getSampleSize());
            existing.setPersonaCalculatedAt(LocalDateTime.now());
            profileMapper.updateById(existing);
        }
    }
}
