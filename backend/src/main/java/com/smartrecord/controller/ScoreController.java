package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.score.ChartDataResp;
import com.smartrecord.dto.score.ScoreBatchResp;
import com.smartrecord.dto.score.ScoreSubmitResp;
import com.smartrecord.dto.score.SessionScoreResp;
import com.smartrecord.dto.score.SubmitScoreReq;
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

    @Operation(
            summary = "提交记分",
            description = "一次提交为一轮，包含多个玩家得分和可选图片。同一秒内提交的记录视为同一批次。使用 Redisson 分布式锁防并发"
    )
    @PostMapping
    public Result<ScoreSubmitResp> submitScore(
            HttpServletRequest request,
            @Valid @RequestBody SubmitScoreReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.submitScore(userId, req));
    }

    @Operation(
            summary = "获取场次完整流水",
            description = "进行中的场次从 Redis 读取（高性能），已结算的场次从 MySQL 读取。返回按批次分组的流水和各玩家总分"
    )
    @GetMapping("/session/{sessionId}")
    public Result<SessionScoreResp> getSessionScores(
            @Parameter(description = "场次 ID") @PathVariable Long sessionId) {
        return Result.ok(scoreService.getSessionScores(sessionId));
    }


    @Operation(summary = "获取房间折线图数据", description = "返回当前活跃场次各成员的累计积分变化序列")
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

    // ===== 房间级接口（前端使用这些） =====

    @Operation(summary = "获取房间当前轮排行榜")
    @GetMapping("/room/{roomId}/ranking")
    public Result<List<ScoreBatchResp.PlayerScoreVO>> getRoomRanking(
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        return Result.ok(scoreService.getRoomRanking(roomId));
    }

    @Operation(summary = "获取房间最近几轮流水")
    @GetMapping("/room/{roomId}/recent")
    public Result<List<ScoreBatchResp>> getRoomRecentScores(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "获取最近 N 轮") @RequestParam(defaultValue = "10") Integer count) {
        return Result.ok(scoreService.getRoomRecentScores(roomId, count));
    }

    @Operation(summary = "结束当前轮", description = "房主操作，结算当前轮并自动开启新一轮")
    @PostMapping("/room/{roomId}/settle")
    public Result<Void> settleRoom(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        scoreService.settleRoom(userId, roomId);
        return Result.ok();
    }
}
