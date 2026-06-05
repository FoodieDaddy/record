package com.smartrecord.service;

import com.smartrecord.dto.mirror.MirrorStatsResp;

public interface MirrorStatsService {

    /** 计算五维战力雷达图数据 */
    MirrorStatsResp calculate(Long userId);
}
