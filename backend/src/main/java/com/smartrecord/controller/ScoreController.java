package com.smartrecord.controller;

import com.smartrecord.common.PageResult;
import com.smartrecord.common.Result;
import com.smartrecord.dto.score.*;
import com.smartrecord.service.OverviewService;
import com.smartrecord.service.ScoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "记分模块", description = "提交得分、查询流水、排行榜")
@RestController
@RequestMapping("/score")
@RequiredArgsConstructor
public class ScoreController {

    private final ScoreService scoreService;
    private final OverviewService overviewService;

    @Operation(summary = "提交记分", description = "一次提交包含多个玩家得分和可选图片。使用 Redisson 分布式锁防并发")
    @PostMapping
    public Result<ScoreSubmitResp> submitScore(
            HttpServletRequest request,
            @Valid @RequestBody SubmitScoreReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.submitScore(userId, req));
    }

    @Operation(summary = "获取房间折线图数据", description = "返回各成员的累计积分变化序列")
    @GetMapping("/room/{roomId}/chart")
    public Result<ChartDataResp> getChartData(
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        return Result.ok(scoreService.getChartData(roomId));
    }

    @Operation(summary = "获取房间总览缓存", description = "优先读取缓存，miss 时同步计算")
    @GetMapping("/room/{roomId}/overview")
    public Result<String> getRoomOverview(
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        return Result.ok(overviewService.getCachedOverview(roomId));
    }

    @Operation(summary = "获取房间排行榜")
    @GetMapping("/room/{roomId}/ranking")
    public Result<List<ScoreBatchResp.PlayerScoreVO>> getRoomRanking(
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        return Result.ok(scoreService.getRoomRanking(roomId));
    }

    @Operation(summary = "获取房间最近记分记录")
    @GetMapping("/room/{roomId}/recent")
    public Result<List<ScoreBatchResp>> getRoomRecentScores(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "获取最近 N 条") @RequestParam(defaultValue = "10") Integer count) {
        return Result.ok(scoreService.getRoomRecentScores(roomId, count));
    }

    @Operation(summary = "发起计分", description = "自由流转模式，A 给 B 计分")
    @PostMapping("/transfer")
    public Result<TransferScoreResp> transferScore(
            HttpServletRequest request,
            @Valid @RequestBody TransferScoreReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.transferScore(userId, req));
    }

    @Operation(summary = "房间计分流水（分页）")
    @GetMapping("/transfer/room/{roomId}")
    public Result<PageResult<TransferScoreResp>> getRoomTransfers(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") Integer size) {
        return Result.ok(scoreService.getRoomTransfers(roomId, page, size));
    }

    @Operation(summary = "结束对局", description = "房主操作，数据归档到房间")
    @PostMapping("/room/{roomId}/settle")
    public Result<SettleResp> settleRoom(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.settleRoom(userId, roomId, false));
    }
}
