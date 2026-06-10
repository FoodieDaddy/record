package com.smartrecord.service.impl.ws;

import lombok.Builder;
import lombok.Data;

/**
 * WebSocket 消息统一信封
 * 为前端提供 messageId 和 serverTime，支持关键事件补偿和去重
 */
@Data
@Builder
public class WsMessage {

    /** 消息唯一标识，用于前端去重和补偿 */
    private String messageId;

    /** 服务端发送时间戳 */
    private long serverTime;

    /** 消息类型 */
    private String type;

    /** 所属房间 ID */
    private String roomId;

    /** 消息数据 */
    private Object data;
}
