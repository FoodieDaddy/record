package com.smartrecord.controller.admin;

import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.DashboardOverviewResp;
import com.smartrecord.service.admin.AdminDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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
}
