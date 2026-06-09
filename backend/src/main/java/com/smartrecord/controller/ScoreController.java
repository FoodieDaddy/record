package com.smartrecord.controller;

import com.smartrecord.common.PageResult;
import com.smartrecord.common.Result;
import com.smartrecord.common.RoomAccessGuard;
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
    private final RoomAccessGuard roomAccessGuard;

    @Operation(summary = "提交记分", description = "一次提交包含多个玩家得分。使用 Redisson 分布式锁防并发")
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
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(scoreService.getChartData(roomId));
    }

    @Operation(summary = "获取房间总览缓存", description = "优先读取缓存，miss 时同步计算")
    @GetMapping("/room/{roomId}/overview")
    public Result<String> getRoomOverview(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(overviewService.getCachedOverview(roomId));
    }

    @Operation(summary = "获取房间排行榜")
    @GetMapping("/room/{roomId}/ranking")
    public Result<List<ScoreBatchResp.PlayerScoreVO>> getRoomRanking(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(scoreService.getRoomRanking(roomId));
    }

    @Operation(summary = "获取房间最近记分记录")
    @GetMapping("/room/{roomId}/recent")
    public Result<List<ScoreBatchResp>> getRoomRecentScores(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "获取最近 N 条") @RequestParam(defaultValue = "10") Integer count) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
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
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") Integer size) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(scoreService.getRoomTransfers(roomId, page, size));
    }

    @Operation(summary = "常用转出金额推荐", description = "从 Redis 小排行读取个人常发与编队高频金额，数据不足时随机补齐")
    @GetMapping("/room/{roomId}/transfer-amount-suggestions")
    public Result<TransferAmountSuggestionResp> getTransferAmountSuggestions(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(scoreService.getTransferAmountSuggestions(userId, roomId));
    }

    @Operation(summary = "结束对局", description = "房主操作，数据归档到房间")
    @PostMapping("/room/{roomId}/settle")
    public Result<SettleResp> settleRoom(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.settleRoom(userId, roomId, false));
    }

    @Operation(summary = "多场趋势", description = "返回用户最近 N 场的净胜分趋势")
    @GetMapping("/trend")
    public Result<TrendResp> getTrend(
            HttpServletRequest request,
            @Parameter(description = "返回最近 N 场") @RequestParam(defaultValue = "20") Integer limit) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.getTrend(userId, Math.min(limit, 50)));
    }

    @Operation(summary = "积分流水终端", description = "聚合净积分、采样状态、积分曲线、对局记录")
    @GetMapping("/yield-log")
    public Result<YieldLogResp> getYieldLog(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(scoreService.getYieldLog(userId));
    }

    @Operation(summary = "战局洞察", description = "返回总流转量、最大流转、最活跃用户、互动密度等")
    @GetMapping("/room/{roomId}/insight")
    public Result<RoomInsightResp> getRoomInsight(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(scoreService.getRoomInsight(roomId));
    }

    @Operation(summary = "积分关系网络", description = "返回节点（含当前积分）和连线（含净流转额）")
    @GetMapping("/room/{roomId}/network")
    public Result<RoomNetworkResp> getRoomNetwork(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(scoreService.getRoomNetwork(roomId));
    }
}
