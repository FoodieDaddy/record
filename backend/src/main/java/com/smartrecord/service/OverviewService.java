package com.smartrecord.service;

/**
 * 总览数据异步计算服务
 */
public interface OverviewService {

    /** 异步计算并缓存房间总览数据 */
    void computeOverview(Long roomId);

    /** 获取缓存的总览数据，miss 时同步计算 */
    String getCachedOverview(Long roomId);
}
