package com.mahjong.score.controller;

import com.mahjong.score.common.Result;
import com.mahjong.score.dto.transfer.TransferReq;
import com.mahjong.score.dto.transfer.TransferResp;
import com.mahjong.score.service.TransferService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "转账模块", description = "房间内转账、撤回")
@RestController
@RequestMapping("/transfer")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;

    @Operation(summary = "发起转账")
    @PostMapping
    public Result<TransferResp> transfer(
            HttpServletRequest request,
            @Valid @RequestBody TransferReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(transferService.transfer(userId, req));
    }

    @Operation(summary = "房间转账记录")
    @GetMapping("/room/{roomId}")
    public Result<List<TransferResp>> getRoomTransfers(
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        return Result.ok(transferService.getRoomTransfers(roomId));
    }

    @Operation(summary = "撤回转账", description = "仅转账人可操作，限 5 分钟内")
    @DeleteMapping("/{transferId}")
    public Result<Void> revokeTransfer(
            HttpServletRequest request,
            @Parameter(description = "转账 ID") @PathVariable Long transferId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        transferService.revokeTransfer(userId, transferId);
        return Result.ok();
    }
}
