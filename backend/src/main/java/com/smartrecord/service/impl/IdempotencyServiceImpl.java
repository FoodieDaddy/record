package com.smartrecord.service.impl;

import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.service.IdempotencyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * 幂等性服务实现 — 基于 Redis SETNX 的请求去重
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class IdempotencyServiceImpl implements IdempotencyService {

    private static final String KEY_PREFIX = "sr:idempotent:";
    private static final String PROCESSING = "PROCESSING";

    private final StringRedisTemplate stringRedisTemplate;

    @Override
    public String checkAndLock(String userId, String operation, String clientRequestId, long expireSeconds) {
        String key = KEY_PREFIX + userId + ":" + operation + ":" + clientRequestId;
        try {
            Boolean absent = stringRedisTemplate.opsForValue()
                    .setIfAbsent(key, PROCESSING, Duration.ofSeconds(expireSeconds));
            if (Boolean.TRUE.equals(absent)) {
                // 首次请求，已设置锁
                return null;
            }
            // 重复请求，返回当前值（PROCESSING 或已缓存的结果 JSON）
            return stringRedisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            // 写操作不能在失去幂等保护时继续执行，否则可能重复计分。
            log.error("幂等检查 Redis 异常，拒绝写入: key={}, error={}", key, e.getMessage());
            throw new BizException(ErrorCode.SYSTEM_BUSY);
        }
    }

    @Override
    public void markSuccess(String userId, String operation, String clientRequestId, String resultJson, long expireSeconds) {
        String key = KEY_PREFIX + userId + ":" + operation + ":" + clientRequestId;
        try {
            stringRedisTemplate.opsForValue().set(key, resultJson, Duration.ofSeconds(expireSeconds));
        } catch (Exception e) {
            log.warn("幂等结果缓存 Redis 异常: key={}, error={}", key, e.getMessage());
        }
    }
}
