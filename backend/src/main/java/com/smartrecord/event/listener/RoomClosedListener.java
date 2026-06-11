package com.smartrecord.event.listener;

import com.smartrecord.event.RoomClosedEvent;
import com.smartrecord.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 房间关闭事件监听器，使用虚拟线程池异步执行云端小程序码回收
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomClosedListener {

    private final StorageService storageService;

    @Async("asyncExecutor")
    @EventListener
    public void handleRoomClosed(RoomClosedEvent event) {
        String roomNo = event.getRoomNo();
        log.info("接收到房间关闭事件，开始异步清理云端小程序码: roomNo={}", roomNo);
        try {
            storageService.deleteObjectAsync("qrcode/" + roomNo + ".png");
            log.info("异步清理云端小程序码成功: roomNo={}", roomNo);
        } catch (Exception e) {
            log.warn("异步清理云端小程序码失败: roomNo={}", roomNo, e);
        }
    }
}
