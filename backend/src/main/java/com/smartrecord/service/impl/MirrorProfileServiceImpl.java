package com.smartrecord.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.dto.mirror.BirthProfileReq;
import com.smartrecord.dto.mirror.MbtiTestReq;
import com.smartrecord.dto.mirror.MirrorDashboardResp.ProfileInfo;
import com.smartrecord.entity.MirrorBirthProfile;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.mapper.MirrorBirthProfileMapper;
import com.smartrecord.mapper.UserMirrorProfileMapper;
import com.smartrecord.service.MirrorProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorProfileServiceImpl implements MirrorProfileService {

    private final UserMirrorProfileMapper profileMapper;
    private final MirrorBirthProfileMapper birthMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String CACHE_KEY_PROFILE = "sr:mirror:profile:";
    private static final String CACHE_KEY_DASHBOARD = "sr:mirror:dashboard:";

    @Override
    public ProfileInfo submitMbtiTest(Long userId, MbtiTestReq req) {
        if (req.getAnswers() == null || req.getAnswers().size() != 20) {
            throw new BizException("必须提交20题答案");
        }

        MbtiCalculator.Result result = MbtiCalculator.calculate(req.getAnswers());

        UserMirrorProfile profile = new UserMirrorProfile();
        profile.setUserId(userId);
        profile.setMbtiType(result.type());
        profile.setMbtiSource("test");
        profile.setMbtiConfidence(BigDecimal.valueOf(result.confidence()));
        profile.setMbtiTestVersion(req.getTestVersion());
        profile.setMbtiAnswersJson(java.util.List.copyOf(
                req.getAnswers().stream().map(a -> (Object) a).toList()));
        profile.setMbtiTitle(result.title());
        profile.setCalibratedAt(LocalDateTime.now());

        saveProfile(profile);
        return toProfileInfo(profile);
    }

    @Override
    public ProfileInfo submitMbtiDirect(Long userId, String mbtiType) {
        String upperType = mbtiType.toUpperCase();
        if (!MbtiCalculator.isValidType(upperType)) {
            throw new BizException("非法MBTI类型: " + mbtiType);
        }

        UserMirrorProfile profile = new UserMirrorProfile();
        profile.setUserId(userId);
        profile.setMbtiType(upperType);
        profile.setMbtiSource("direct");
        profile.setMbtiConfidence(BigDecimal.valueOf(100));
        profile.setMbtiTitle(MbtiCalculator.getTitle(upperType));
        profile.setCalibratedAt(LocalDateTime.now());

        saveProfile(profile);
        return toProfileInfo(profile);
    }

    @Override
    public void saveBirthProfile(Long userId, BirthProfileReq req) {
        MirrorBirthProfile entity = new MirrorBirthProfile();
        entity.setUserId(userId);
        entity.setCalendarType(req.getCalendarType() != null ? req.getCalendarType() : "solar");
        entity.setBirthDate(req.getBirthDate() != null ? LocalDate.parse(req.getBirthDate()) : null);
        entity.setBirthTime(req.getBirthTime());
        entity.setBirthPlace(req.getBirthPlace());
        entity.setTimezone(req.getTimezone() != null ? req.getTimezone() : "Asia/Shanghai");
        entity.setGender(req.getGender());

        MirrorBirthProfile existing = birthMapper.selectById(userId);
        if (existing != null) {
            birthMapper.updateById(entity);
        } else {
            birthMapper.insert(entity);
        }

        clearDashboardCache(userId);
        log.info("出生档案已保存: userId={}", userId);
    }

    @Override
    public BirthProfileReq getBirthProfile(Long userId) {
        MirrorBirthProfile entity = getBirthProfileEntity(userId);
        if (entity == null) return null;

        BirthProfileReq req = new BirthProfileReq();
        req.setCalendarType(entity.getCalendarType());
        req.setBirthDate(entity.getBirthDate() != null ? entity.getBirthDate().toString() : null);
        req.setBirthTime(entity.getBirthTime());
        req.setBirthPlace(entity.getBirthPlace());
        req.setTimezone(entity.getTimezone());
        req.setGender(entity.getGender());
        return req;
    }

    @Override
    public UserMirrorProfile getProfile(Long userId) {
        return profileMapper.selectById(userId);
    }

    @Override
    public MirrorBirthProfile getBirthProfileEntity(Long userId) {
        return birthMapper.selectById(userId);
    }

    private void saveProfile(UserMirrorProfile profile) {
        UserMirrorProfile existing = profileMapper.selectById(profile.getUserId());
        if (existing != null) {
            profileMapper.updateById(profile);
        } else {
            profileMapper.insert(profile);
        }

        clearProfileCache(profile.getUserId());
        clearDashboardCache(profile.getUserId());
        log.info("MBTI已保存: userId={}, type={}, source={}", profile.getUserId(), profile.getMbtiType(), profile.getMbtiSource());
    }

    private ProfileInfo toProfileInfo(UserMirrorProfile p) {
        return ProfileInfo.builder()
                .calibrated(p.getMbtiType() != null)
                .mbtiType(p.getMbtiType())
                .mbtiTitle(p.getMbtiTitle())
                .confidence(p.getMbtiConfidence())
                .mbtiSource(p.getMbtiSource())
                .calibratedAt(p.getCalibratedAt() != null ? p.getCalibratedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : null)
                .build();
    }

    private void clearProfileCache(Long userId) {
        try {
            redisTemplate.delete(CACHE_KEY_PROFILE + userId);
        } catch (Exception e) {
            log.warn("清除profile缓存失败: userId={}", userId);
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
