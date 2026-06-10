package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.dto.fortune.FortuneResp;
import com.smartrecord.service.FortuneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "策略模块", description = "每日状态监测（策略提示）")
@RestController
@RequestMapping("/fortune")
@RequiredArgsConstructor
public class FortuneController {

    private final FortuneService fortuneService;

    @Operation(summary = "获取今日策略", description = "基于用户历史画像 + 大模型生成每日策略提示")
    @GetMapping("/today")
    public Result<FortuneResp> getTodayFortune(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "false") boolean force) {
        return Result.ok(fortuneService.getTodayFortune(userId, force));
    }
}
