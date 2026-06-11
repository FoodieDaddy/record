package com.smartrecord.event.listener;

import com.smartrecord.event.MirrorPersonaRebuildEvent;
import com.smartrecord.service.MirrorProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * AI画像重建事件监听器，使用虚拟线程池异步预热画像数据
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MirrorPersonaRebuildListener {

    private final MirrorProfileService mirrorProfileService;

    @Async("asyncExecutor")
    @EventListener
    public void handleMirrorPersonaRebuild(MirrorPersonaRebuildEvent event) {
        Long userId = event.getUserId();
        log.info("接收到AI画像重建事件，开始异步预热行为画像: userId={}", userId);
        try {
            // 主动拉取最新画像以触发大模型计算并放入 JetCache 二级缓存中完成预热
            mirrorProfileService.getFullProfile(userId);
            log.info("AI行为画像数据异步预热重建成功: userId={}", userId);
        } catch (Exception e) {
            log.warn("AI行为画像数据异步预热重建失败: userId={}", userId, e);
        }
    }
}
