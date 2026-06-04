package com.smartrecord.service;

import com.smartrecord.dto.score.ChartDataResp;

/**
 * 总览数据异步计算服务
 */
public interface OverviewService {

    /** 异步计算并缓存房间总览数据 */
    void computeOverview(Long roomId);

    /** 获取缓存的总览数据，miss 时同步计算 */
    String getCachedOverview(Long roomId);

    /** 获取房间图表数据（进行中从 Redis，已结算从 all_record） */
    ChartDataResp getChartData(Long roomId);
}
