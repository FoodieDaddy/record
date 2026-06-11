package com.smartrecord.event.listener;

import com.smartrecord.event.BehaviorLogReportEvent;
import com.smartrecord.service.BehaviorLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 前端行为日志批量上报事件监听器，使用虚拟线程池异步入库
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BehaviorLogListener {

    private final BehaviorLogService behaviorLogService;

    @Async("asyncExecutor")
    @EventListener
    public void handleBehaviorLogReportEvent(BehaviorLogReportEvent event) {
        log.info("接收到前端行为日志上报事件: userId={}, 批量数量={}", event.getUserId(), event.getReports().size());
        try {
            behaviorLogService.saveBatchLogs(
                    event.getUserId(),
                    event.getIp(),
                    event.getUserAgent(),
                    event.getReports()
            );
            log.info("前端行为日志批量入库处理完成: userId={}", event.getUserId());
        } catch (Exception e) {
            log.error("处理前端行为日志批量入库异步任务失败: userId={}", event.getUserId(), e);
        }
    }
}
