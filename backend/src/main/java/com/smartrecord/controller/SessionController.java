package com.smartrecord.controller;

import com.smartrecord.common.PageResult;
import com.smartrecord.common.Result;
import com.smartrecord.dto.session.CreateSessionReq;
import com.smartrecord.dto.session.SessionResp;
import com.smartrecord.service.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "场次模块", description = "房间内的场次管理（开始/结算/查询）")
@RestController
@RequestMapping("/session")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @Operation(summary = "创建场次", description = "在房间内开启新的一场对局")
    @PostMapping
    public Result<SessionResp> createSession(
            HttpServletRequest request,
            @Valid @RequestBody CreateSessionReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(sessionService.createSession(userId, req));
    }

    @Operation(summary = "获取房间的场次列表", description = "按场次序号倒序返回")
    @GetMapping("/room/{roomId}")
    public Result<List<SessionResp>> getSessionsByRoom(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") Integer size) {
        return Result.ok(sessionService.getSessionsByRoom(roomId, page, size));
    }

}
