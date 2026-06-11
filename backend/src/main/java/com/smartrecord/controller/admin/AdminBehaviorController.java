package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.entity.BehaviorLog;
import com.smartrecord.dto.admin.BehaviorDashboardResp;
import com.smartrecord.service.BehaviorLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin 行为日志监控")
@RestController
@RequestMapping("/admin/behavior")
@RequiredArgsConstructor
public class AdminBehaviorController {

    private final BehaviorLogService behaviorLogService;

    @Operation(summary = "分页检索行为日志")
    @GetMapping("/page")
    public Result<Page<BehaviorLog>> page(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return Result.ok(behaviorLogService.getPageLogs(page, size, actionType, userId, keyword, startTime, endTime));
    }

    @Operation(summary = "监控看板统计数据")
    @GetMapping("/dashboard")
    public Result<BehaviorDashboardResp> dashboard() {
        return Result.ok(behaviorLogService.getBehaviorDashboardStats());
    }
}
