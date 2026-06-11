package com.smartrecord.event;

import com.smartrecord.entity.Room;
import org.springframework.context.ApplicationEvent;
import java.util.List;
import java.util.Map;

/**
 * 房间结算完成事件。
 * 承载结算后的房间实体、玩家最终得分 Map 以及全局对局快照数据。
 */
public class RoomSettledEvent extends ApplicationEvent {

    private final Room room;
    private final Map<Long, Integer> playerTotalMap;
    private final List<Map<String, Object>> allRecord;

    public RoomSettledEvent(Object source, Room room, Map<Long, Integer> playerTotalMap, List<Map<String, Object>> allRecord) {
        super(source);
        this.room = room;
        this.playerTotalMap = playerTotalMap;
        this.allRecord = allRecord;
    }

    public Room getRoom() {
        return room;
    }

    public Map<Long, Integer> getPlayerTotalMap() {
        return playerTotalMap;
    }

    public List<Map<String, Object>> getAllRecord() {
        return allRecord;
    }
}
