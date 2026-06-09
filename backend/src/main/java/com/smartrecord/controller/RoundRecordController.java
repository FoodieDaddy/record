package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.common.RoomAccessGuard;
import com.smartrecord.dto.round.ConfirmRoundReq;
import com.smartrecord.dto.round.RoundRecordResp;
import com.smartrecord.dto.round.StartRoundReq;
import com.smartrecord.dto.round.SubmitRoundReq;
import com.smartrecord.service.RoundRecordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "本局录模块", description = "发起本局录、提交分数、确认/驳回、取消")
@RestController
@RequestMapping("/round")
@RequiredArgsConstructor
public class RoundRecordController {

    private final RoundRecordService roundRecordService;
    private final RoomAccessGuard roomAccessGuard;

    @Operation(summary = "发起本局录", description = "仅房主可操作，根据房间配置进入对应流程")
    @PostMapping("/start")
    public Result<RoundRecordResp> startRound(
            HttpServletRequest request,
            @Valid @RequestBody StartRoundReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roundRecordService.startRound(userId, req.getRoomId()));
    }

    @Operation(summary = "提交分数", description = "房主填写所有成员分数，或成员填写自己的分数")
    @PostMapping("/submit")
    public Result<RoundRecordResp> submitRound(
            HttpServletRequest request,
            @Valid @RequestBody SubmitRoundReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roundRecordService.submitRound(userId, req));
    }

    @Operation(summary = "确认/驳回", description = "全员确认阶段，同意或驳回本局录")
    @PostMapping("/confirm")
    public Result<RoundRecordResp> confirmRound(
            HttpServletRequest request,
            @Valid @RequestBody ConfirmRoundReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roundRecordService.confirmRound(userId, req));
    }

    @Operation(summary = "取消本局录", description = "仅房主可操作，取消待处理的本局录")
    @PostMapping("/cancel")
    public Result<Void> cancelRound(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @RequestParam Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roundRecordService.cancelRound(userId, roomId);
        return Result.ok();
    }

    @Operation(summary = "获取待处理本局录", description = "获取当前房间的待处理本局录")
    @GetMapping("/pending")
    public Result<RoundRecordResp> getPending(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @RequestParam Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(roundRecordService.getPending(roomId));
    }
}
