package com.smartrecord.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.dto.user.IdentityLevelResp;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.UserIdentityLevel;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.common.BizException;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserIdentityLevelMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.mapper.UserMirrorProfileMapper;
import com.smartrecord.service.IdentityLevelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdentityLevelServiceImpl implements IdentityLevelService {

    private final UserMapper userMapper;
    private final UserIdentityLevelMapper identityLevelMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final UserMirrorProfileMapper mirrorProfileMapper;

    /** 等级称号 */
    private static final String[] LEVEL_TITLES = {
            "", "新人观察员", "桌面参与者", "策略执行者", "局势掌控者", "法雷达候选者"
    };

    /** 等级经验阈值：index = level，expThresholds[i] 表示升到 i 级所需累计经验 */
    private static final int[] EXP_THRESHOLDS = {0, 0, 100, 500, 1500, 4000, 8000};

    @Override
    public IdentityLevelResp getIdentityLevel(Long userId) {
        // 优先读数据库缓存
        UserIdentityLevel existing = identityLevelMapper.selectById(userId);
        if (existing != null) {
            log.info("命中身份等级缓存: userId={}, level={}", userId, existing.getLevel());
            return buildResp(existing);
        }

        // 无缓存，实时计算并持久化
        log.info("身份等级无缓存，实时计算: userId={}", userId);
        UserIdentityLevel computed = recalculateInternal(userId);
        return buildResp(computed);
    }

    @Override
    public void recalculate(Long userId) {
        recalculateInternal(userId);
        log.info("身份等级已重算: userId={}", userId);
    }

    // ---- 核心计算 ----

    private UserIdentityLevel recalculateInternal(Long userId) {
        // 0. 校验用户存在性（防止 JWT 中的 userId 在 user 表中不存在导致外键约束失败）
        if (userMapper.selectById(userId) == null) {
            throw new BizException("用户不存在");
        }

        // 1. 查询已结算场次（quitTime 不为空的去重房间数）
        int matchCount = roomMemberMapper.countSettledRooms(userId);

        // 2. 查询所有已结算的 room_member 记录，计算总分和胜率
        List<RoomMember> settledRecords = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getUserId, userId)
                        .isNotNull(RoomMember::getQuitTime)
        );

        int totalScore = 0;
        int winCount = 0;
        for (RoomMember rm : settledRecords) {
            if (rm.getFinalScore() != null) {
                totalScore += rm.getFinalScore();
                if (rm.getFinalScore() > 0) {
                    winCount++;
                }
            }
        }

        // 3. 查询 MBTI 是否已校准
        boolean mbtiCalibrated = false;
        UserMirrorProfile profile = mirrorProfileMapper.selectById(userId);
        if (profile != null && profile.getMbtiCode() != null && profile.getMbtiCode() > 0) {
            mbtiCalibrated = true;
        }

        // 4. 计算等级（从高到低匹配）
        double winRate = matchCount > 0 ? (winCount * 100.0 / matchCount) : 0;
        int level = calcLevel(matchCount, winRate, totalScore, mbtiCalibrated);

        // 5. 计算经验值
        int exp = matchCount * 10 + Math.max(0, totalScore) + (mbtiCalibrated ? 200 : 0);

        // 6. 计算稳定度
        Integer stability = calcStability(userId);

        // 7. 持久化
        UserIdentityLevel entity = new UserIdentityLevel();
        entity.setUserId(userId);
        entity.setLevel(level);
        entity.setExp(exp);
        entity.setStability(stability);
        entity.setUpdatedAt(LocalDateTime.now());

        UserIdentityLevel existing = identityLevelMapper.selectById(userId);
        if (existing != null) {
            identityLevelMapper.updateById(entity);
        } else {
            identityLevelMapper.insert(entity);
        }

        log.info("身份等级计算完成: userId={}, level={}, exp={}, stability={}, matchCount={}",
                userId, level, exp, stability, matchCount);

        return entity;
    }

    /**
     * 等级判定（从高到低匹配）
     * Lv.5 法雷达候选者: matchCount >= 100 AND mbtiCalibrated
     * Lv.4 局势掌控者: matchCount >= 50 AND winRate >= 50
     * Lv.3 策略执行者: matchCount >= 20 AND totalScore >= 100
     * Lv.2 桌面参与者: matchCount >= 5
     * Lv.1 新人观察员: default
     */
    private int calcLevel(int matchCount, double winRate, int totalScore, boolean mbtiCalibrated) {
        if (matchCount >= 100 && mbtiCalibrated) return 5;
        if (matchCount >= 50 && winRate >= 50) return 4;
        if (matchCount >= 20 && totalScore >= 100) return 3;
        if (matchCount >= 5) return 2;
        return 1;
    }

    /**
     * 稳定度：近场净得分标准差 → clamp(round(100 - sigma * 2.0), 0, 100)
     * matchCount < 3 时返回 null
     */
    private Integer calcStability(Long userId) {
        // 复用 selectTrendByUserId 获取最近 10 场净得分
        List<Map<String, Object>> trend = roomMemberMapper.selectTrendByUserId(userId, 10);
        List<Integer> netScores = new ArrayList<>();
        for (Map<String, Object> row : trend) {
            Object ns = row.get("netScore");
            if (ns instanceof Number) {
                netScores.add(((Number) ns).intValue());
            }
        }

        if (netScores.size() < 3) {
            return null;
        }

        double sigma = stdDev(netScores);
        int stability = (int) Math.round(100 - sigma * 2.0);
        return Math.max(0, Math.min(100, stability));
    }

    // ---- 工具方法 ----

    private double stdDev(List<Integer> values) {
        if (values.size() <= 1) return 0;
        double mean = values.stream().mapToInt(Integer::intValue).average().orElse(0);
        double sumSq = 0;
        for (int v : values) {
            sumSq += (v - mean) * (v - mean);
        }
        return Math.sqrt(sumSq / values.size());
    }

    /**
     * 构建响应 DTO
     */
    private IdentityLevelResp buildResp(UserIdentityLevel entity) {
        int level = entity.getLevel();
        int exp = entity.getExp();

        // 当前等级的起始阈值和下一级阈值
        int currentThreshold = EXP_THRESHOLDS[level];
        int nextThreshold = level < 5 ? EXP_THRESHOLDS[level + 1] : EXP_THRESHOLDS[5];

        // 当前等级内已获得经验和所需区间
        int currentLevelExp = exp - currentThreshold;
        int requiredExpInLevel = nextThreshold - currentThreshold;

        // 进度百分比
        int progress;
        if (level >= 5) {
            progress = 100;
            currentLevelExp = 0;
            requiredExpInLevel = 0;
        } else {
            progress = requiredExpInLevel > 0 ? Math.min(100, currentLevelExp * 100 / requiredExpInLevel) : 0;
        }

        return IdentityLevelResp.builder()
                .level(level)
                .title(LEVEL_TITLES[level])
                .exp(exp)
                .currentLevelExp(currentLevelExp)
                .requiredExpInLevel(requiredExpInLevel)
                .nextLevelExp(nextThreshold)
                .progress(progress)
                .stability(entity.getStability())
                .build();
    }
}
