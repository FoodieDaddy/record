package com.smartrecord.controller;

import com.smartrecord.common.PageResult;
import com.smartrecord.common.Result;
import com.smartrecord.dto.mirror.*;
import com.smartrecord.service.MirrorProfileService;
import com.smartrecord.service.MirrorReportService;
import com.smartrecord.service.MirrorService;
import com.smartrecord.service.MirrorToolService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "镜像模块", description = "MBTI人格校准 + taibu多维测试终端")
@RestController
@RequestMapping("/mirror")
@RequiredArgsConstructor
public class MirrorController {

    private final MirrorService mirrorService;
    private final MirrorProfileService mirrorProfileService;
    private final MirrorToolService mirrorToolService;
    private final MirrorReportService mirrorReportService;

    @Operation(summary = "首页聚合数据")
    @GetMapping("/dashboard")
    public Result<MirrorDashboardResp> dashboard(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorService.getDashboard(userId));
    }

    @Operation(summary = "MBTI 20题测试")
    @PostMapping("/mbti/test")
    public Result<MirrorDashboardResp.ProfileInfo> mbtiTest(
            HttpServletRequest request, @Valid @RequestBody MbtiTestReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.submitMbtiTest(userId, req));
    }

    @Operation(summary = "MBTI直接输入")
    @PostMapping("/mbti/direct")
    public Result<MirrorDashboardResp.ProfileInfo> mbtiDirect(
            HttpServletRequest request, @Valid @RequestBody MbtiDirectReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.submitMbtiDirect(userId, req.getMbtiType()));
    }

    @Operation(summary = "运行工具")
    @PostMapping("/tool/run")
    public Result<MirrorToolRunResp> runTool(
            HttpServletRequest request, @Valid @RequestBody MirrorToolRunReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorToolService.runTool(userId, req));
    }

    @Operation(summary = "获取测试结果详情")
    @GetMapping("/report/{id}")
    public Result<MirrorReportResp> getReport(
            HttpServletRequest request, @PathVariable Long id) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorReportService.getReport(userId, id));
    }

    @Operation(summary = "获取测试档案")
    @GetMapping("/archive")
    public Result<PageResult<MirrorArchiveItem>> getArchive(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String category) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorReportService.getArchive(userId, page, pageSize, category));
    }

    @Operation(summary = "保存出生档案")
    @PostMapping("/birth-profile")
    public Result<Void> saveBirthProfile(
            HttpServletRequest request, @RequestBody BirthProfileReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        mirrorProfileService.saveBirthProfile(userId, req);
        return Result.ok();
    }

    @Operation(summary = "获取出生档案")
    @GetMapping("/birth-profile")
    public Result<BirthProfileReq> getBirthProfile(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.getBirthProfile(userId));
    }
}
