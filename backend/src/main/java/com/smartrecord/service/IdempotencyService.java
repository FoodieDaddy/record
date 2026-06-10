package com.smartrecord.service;

/**
 * 幂等性服务 — 基于 Redis 的请求去重
 */
public interface IdempotencyService {

    /**
     * 检查幂等键是否已存在。
     *
     * @param userId         当前用户 ID
     * @param operation      操作类型标识
     * @param clientRequestId 客户端请求 ID
     * @param expireSeconds  幂等键过期时间（秒）
     * @return null 表示首次请求（已设置锁），非 null 表示重复请求（返回缓存结果或 "PROCESSING"）
     */
    String checkAndLock(String userId, String operation, String clientRequestId, long expireSeconds);

    /**
     * 标记处理成功，缓存结果
     *
     * @param userId         当前用户 ID
     * @param operation      操作类型标识
     * @param clientRequestId 客户端请求 ID
     * @param resultJson     结果 JSON
     * @param expireSeconds  幂等键过期时间（秒）
     */
    void markSuccess(String userId, String operation, String clientRequestId, String resultJson, long expireSeconds);
}
