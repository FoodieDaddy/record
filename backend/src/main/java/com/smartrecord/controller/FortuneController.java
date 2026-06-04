package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.fortune.FortuneResp;
import com.smartrecord.service.FortuneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "运势模块", description = "每日状态监测（赛博运势）")
@RestController
@RequestMapping("/fortune")
@RequiredArgsConstructor
public class FortuneController {

    private final FortuneService fortuneService;

    @Operation(summary = "获取今日运势", description = "基于用户历史画像 + 大模型生成每日运势判词")
    @GetMapping("/today")
    public Result<FortuneResp> getTodayFortune(HttpServletRequest request,
                                                @RequestParam(defaultValue = "false") boolean force) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(fortuneService.getTodayFortune(userId, force));
    }
}
