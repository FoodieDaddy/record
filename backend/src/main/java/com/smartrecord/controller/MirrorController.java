package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
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
    public Result<MirrorProfileResp> profile(@CurrentUser Long userId) {
        return Result.ok(mirrorProfileService.getFullProfile(userId));
    }

    @Operation(summary = "刷新战绩画像")
    @PostMapping("/profile/refresh")
    public Result<MirrorProfileResp> refreshProfile(@CurrentUser Long userId) {
        mirrorProfileService.clearProfileCache(userId);
        return Result.ok(mirrorProfileService.getFullProfile(userId));
    }

    @Operation(summary = "MBTI 20题测试")
    @PostMapping("/mbti/test")
    public Result<MirrorProfileResp.ProfileInfo> mbtiTest(
            @CurrentUser Long userId,
            @Valid @RequestBody MbtiTestReq req) {
        return Result.ok(mirrorProfileService.submitMbtiTest(userId, req));
    }

    @Operation(summary = "MBTI直接输入")
    @PostMapping("/mbti/direct")
    public Result<MirrorProfileResp.ProfileInfo> mbtiDirect(
            @CurrentUser Long userId,
            @Valid @RequestBody MbtiDirectReq req) {
        return Result.ok(mirrorProfileService.submitMbtiDirect(userId, req.getMbtiCode()));
    }

    @Operation(summary = "五维战力雷达图数据")
    @GetMapping("/stats")
    public Result<MirrorStatsResp> stats(@CurrentUser Long userId) {
        return Result.ok(mirrorStatsService.calculate(userId));
    }
}
