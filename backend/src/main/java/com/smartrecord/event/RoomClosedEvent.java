package com.smartrecord.event;

import org.springframework.context.ApplicationEvent;

/**
 * 房间关闭（解散）事件
 */
public class RoomClosedEvent extends ApplicationEvent {

    private final String roomNo;

    public RoomClosedEvent(Object source, String roomNo) {
        super(source);
        this.roomNo = roomNo;
    }

    public String getRoomNo() {
        return roomNo;
    }
}
