package com.smartrecord.controller;

import com.smartrecord.common.PageResult;
import com.smartrecord.common.Result;
import com.smartrecord.dto.transfer.TransferReq;
import com.smartrecord.dto.transfer.TransferResp;
import com.smartrecord.service.TransferService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "计分模块", description = "房间内计分")
@RestController
@RequestMapping("/transfer")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;

    @Operation(summary = "发起计分")
    @PostMapping
    public Result<TransferResp> transfer(
            HttpServletRequest request,
            @Valid @RequestBody TransferReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(transferService.transfer(userId, req));
    }

    @Operation(summary = "房间计分记录（分页）")
    @GetMapping("/room/{roomId}")
    public Result<PageResult<TransferResp>> getRoomTransfers(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "场次 ID（可选，不传则查全部）") @RequestParam(required = false) Long sessionId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") Integer size) {
        return Result.ok(transferService.getRoomTransfers(roomId, sessionId, page, size));
    }
}
