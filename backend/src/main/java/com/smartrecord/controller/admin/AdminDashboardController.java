package com.smartrecord.controller.admin;

import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.DashboardOverviewResp;
import com.smartrecord.dto.admin.TraceStatsResp;
import com.smartrecord.dto.admin.TrendDataResp;
import com.smartrecord.service.admin.AdminDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Admin Dashboard")
@RestController
@RequestMapping("/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService dashboardService;

    @Operation(summary = "总览指标")
    @GetMapping("/overview")
    public Result<DashboardOverviewResp> overview() {
        return Result.ok(dashboardService.getOverview());
    }

    @Operation(summary = "趋势数据（近 30 天）")
    @GetMapping("/trends")
    public Result<TrendDataResp> trends() {
        return Result.ok(dashboardService.getTrends());
    }

    @Operation(summary = "航迹中心统计数据")
    @GetMapping("/trace-stats")
    public Result<TraceStatsResp> traceStats() {
        return Result.ok(dashboardService.getTraceStats());
    }

    @Operation(summary = "近期事件流")
    @GetMapping("/events")
    public Result<List<Map<String, Object>>> events() {
        return Result.ok(dashboardService.getRecentEvents());
    }
}
