package com.smartrecord.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.dto.behavior.BehaviorReportReq;
import com.smartrecord.entity.BehaviorLog;
import com.smartrecord.dto.admin.BehaviorDashboardResp;
import java.util.List;

/**
 * 前端行为日志服务接口
 */
public interface BehaviorLogService {

    /**
     * 批量保存前端行为日志
     */
    void saveBatchLogs(Long userId, String ip, String userAgent, List<BehaviorReportReq> reports);

    /**
     * 分页检索行为日志
     */
    Page<BehaviorLog> getPageLogs(
            int page,
            int size,
            String actionType,
            Long userId,
            String keyword,
            String startTime,
            String endTime
    );

    /**
     * 获取行为监控仪表盘统计数据
     */
    BehaviorDashboardResp getBehaviorDashboardStats();
}

