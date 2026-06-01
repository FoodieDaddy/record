package com.mahjong.score.controller;

import com.mahjong.score.common.Result;
import com.mahjong.score.dto.score.ScoreBatchResp;
import com.mahjong.score.dto.score.SessionScoreResp;
import com.mahjong.score.dto.score.SubmitScoreReq;
import com.mahjong.score.service.ScoreService;
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

    @Operation(
            summary = "提交记分",
            description = "一次提交为一轮，包含多个玩家得分和可选图片。同一秒内提交的记录视为同一批次。使用 Redisson 分布式锁防并发"
    )
    @PostMapping
    public Result<Void> submitScore(
            HttpServletRequest request,
            @Valid @RequestBody SubmitScoreReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        scoreService.submitScore(userId, req);
        return Result.ok();
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

    @Operation(
            summary = "获取最新几轮流水",
            description = "用于房间内实时展示最近的记分动态，从 Redis 读取"
    )
    @GetMapping("/session/{sessionId}/recent")
    public Result<List<ScoreBatchResp>> getRecentScores(
            @Parameter(description = "场次 ID") @PathVariable Long sessionId,
            @Parameter(description = "获取最近 N 轮") @RequestParam(defaultValue = "5") Integer count) {
        return Result.ok(scoreService.getRecentScores(sessionId, count));
    }

    @Operation(
            summary = "获取场次排行榜",
            description = "各玩家累计总分排名。进行中场次从 Redis Sorted Set 读取，已结算场次从 MySQL 聚合"
    )
    @GetMapping("/session/{sessionId}/ranking")
    public Result<List<ScoreBatchResp.PlayerScoreVO>> getRanking(
            @Parameter(description = "场次 ID") @PathVariable Long sessionId) {
        return Result.ok(scoreService.getRanking(sessionId));
    }
}
