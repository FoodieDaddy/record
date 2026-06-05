package com.smartrecord.service;

import com.smartrecord.common.PageResult;
import com.smartrecord.dto.mirror.MirrorArchiveItem;
import com.smartrecord.dto.mirror.MirrorReportResp;
import com.smartrecord.entity.MirrorReport;

import java.util.List;

public interface MirrorReportService {

    /**
     * 保存测试报告
     */
    void saveReport(MirrorReport report);

    /**
     * 获取报告详情
     */
    MirrorReportResp getReport(Long userId, Long reportId);

    /**
     * 获取档案列表（分页）
     */
    PageResult<MirrorArchiveItem> getArchive(Long userId, int page, int pageSize, String category);

    /**
     * 获取最近报告（用于首页）
     */
    List<MirrorReport> getRecentReports(Long userId, int limit);
}
