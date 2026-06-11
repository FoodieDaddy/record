package com.smartrecord.event;

import org.springframework.context.ApplicationEvent;

/**
 * AI画像重建（预热）事件
 */
public class MirrorPersonaRebuildEvent extends ApplicationEvent {

    private final Long userId;

    public MirrorPersonaRebuildEvent(Object source, Long userId) {
        super(source);
        this.userId = userId;
    }

    public Long getUserId() {
        return userId;
    }
}
