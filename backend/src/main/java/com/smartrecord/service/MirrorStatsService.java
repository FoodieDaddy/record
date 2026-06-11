package com.smartrecord.service;

import com.smartrecord.dto.mirror.MirrorStatsResp;

public interface MirrorStatsService {

    /** 计算五维战力雷达图数据 */
    MirrorStatsResp calculate(Long userId);

    /** 清除五维战力缓存 */
    void clearStatsCache(Long userId);
}
