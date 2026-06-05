package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.mirror.MbtiDirectReq;
import com.smartrecord.dto.mirror.MbtiTestReq;
import com.smartrecord.dto.mirror.MirrorProfileResp;
import com.smartrecord.dto.mirror.MirrorStatsResp;
import com.smartrecord.service.BattlePersonaService;
import com.smartrecord.service.MirrorProfileService;
import com.smartrecord.service.MirrorStatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "镜像模块", description = "MBTI人格校准 + 战绩人格画像")
@RestController
@RequestMapping("/mirror")
@RequiredArgsConstructor
public class MirrorController {

    private final MirrorProfileService mirrorProfileService;
    private final BattlePersonaService battlePersonaService;
    private final MirrorStatsService mirrorStatsService;

    @Operation(summary = "获取镜像画像")
    @GetMapping("/profile")
    public Result<MirrorProfileResp> profile(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        MirrorProfileResp resp = mirrorProfileService.getFullProfile(userId);
        return Result.ok(resp);
    }

    @Operation(summary = "刷新战绩画像")
    @PostMapping("/profile/refresh")
    public Result<MirrorProfileResp> refreshProfile(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        mirrorProfileService.clearProfileCache(userId);
        MirrorProfileResp resp = mirrorProfileService.getFullProfile(userId);
        return Result.ok(resp);
    }

    @Operation(summary = "MBTI 20题测试")
    @PostMapping("/mbti/test")
    public Result<MirrorProfileResp.ProfileInfo> mbtiTest(
            HttpServletRequest request, @Valid @RequestBody MbtiTestReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.submitMbtiTest(userId, req));
    }

    @Operation(summary = "MBTI直接输入")
    @PostMapping("/mbti/direct")
    public Result<MirrorProfileResp.ProfileInfo> mbtiDirect(
            HttpServletRequest request, @Valid @RequestBody MbtiDirectReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorProfileService.submitMbtiDirect(userId, req.getMbtiCode()));
    }

    @Operation(summary = "五维战力雷达图数据")
    @GetMapping("/stats")
    public Result<MirrorStatsResp> stats(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(mirrorStatsService.calculate(userId));
    }
}
