package com.smartrecord.service.impl.ws;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * WebSocket 跨实例消息订阅处理类。
 * 监听 Redis 广播，在收到事件后，解包提取出目标 roomId 和对应的 JSON 字符串 payload，
 * 触发本地 WebSocket 发送操作，完成多实例集群下的推送互通。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketRedisSubscriber implements MessageListener {

    private final ScoreWebSocket scoreWebSocket;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            // 解析收到广播消息的主体
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            if (body.startsWith("\"") && body.endsWith("\"")) {
                body = body.substring(1, body.length() - 1).replace("\\\"", "\"");
            }
            
            JSONObject obj = JSONUtil.parseObj(body);
            String roomId = obj.getStr("roomId");
            String payload = obj.getStr("payload");

            if (roomId != null && payload != null) {
                // 推送给连在当前实例上的该房间的所有客户端
                scoreWebSocket.sendLocalMessage(roomId, payload);
            }
        } catch (Exception e) {
            log.error("解析并分发 Redis Pub/Sub WebSocket 广播消息失败", e);
        }
    }
}
