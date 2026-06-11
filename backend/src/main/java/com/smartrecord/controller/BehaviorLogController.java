package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.dto.behavior.BehaviorReportReq;
import com.smartrecord.event.BehaviorLogReportEvent;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 前端用户关键行为日志上报控制器
 */
@Slf4j
@Tag(name = "用户行为日志上报")
@RestController
@RequestMapping("/behavior")
@RequiredArgsConstructor
@Validated
public class BehaviorLogController {

    private final ApplicationEventPublisher eventPublisher;

    @Operation(summary = "批量上报用户关键行为日志", description = "前端缓存批量打包上报，接口收到请求后立即异步事件解耦，零延迟响应。")
    @PostMapping("/report")
    public Result<Void> report(
            @CurrentUser Long userId,
            @RequestBody @Valid List<BehaviorReportReq> reqList,
            HttpServletRequest request) {
        
        String ip = request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent");
        
        log.info("接收到前端行为日志上报请求: userId={}, IP={}, 批量大小={}", userId, ip, reqList.size());
        
        // 发布事件，利用虚拟线程池异步执行批量入库，绝不阻塞主响应链路
        eventPublisher.publishEvent(new BehaviorLogReportEvent(this, userId, ip, userAgent, reqList));
        
        return Result.ok();
    }
}
