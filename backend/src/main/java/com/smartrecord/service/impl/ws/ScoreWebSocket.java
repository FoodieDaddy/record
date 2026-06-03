package com.smartrecord.service.impl.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 推送记分实时同步
 * 前端连接: ws://host/api/ws/score?roomId=xxx&token=xxx
 * 房间内任意玩家记分后，推送更新给同房间所有玩家
 */
@Slf4j
@Component
public class ScoreWebSocket extends TextWebSocketHandler {

    /** roomId -> set of sessions */
    private static final Map<String, Set<WebSocketSession>> ROOM_SESSIONS = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public ScoreWebSocket(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomId = getRoomId(session);
        if (roomId == null) {
            try { session.close(); } catch (Exception ignored) {}
            return;
        }
        ROOM_SESSIONS.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("WebSocket 连接建立: roomId={}, sessionId={}", roomId, session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = getRoomId(session);
        if (roomId != null) {
            Set<WebSocketSession> sessions = ROOM_SESSIONS.get(roomId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    ROOM_SESSIONS.remove(roomId);
                }
            }
        }
    }

    /**
     * 向房间内所有连接推送消息
     */
    public void pushToRoom(String roomId, Object message) {
        Set<WebSocketSession> sessions = ROOM_SESSIONS.get(roomId);
        if (sessions == null || sessions.isEmpty()) return;

        String payload;
        try {
            payload = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            log.warn("WebSocket 消息序列化失败", e);
            return;
        }
        TextMessage textMessage = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(textMessage);
                } catch (Exception e) {
                    log.warn("WebSocket 推送失败: {}", session.getId(), e);
                }
            }
        }
    }

    /**
     * 定时清理空房间，防止僵尸房间占用内存
     * 每 5 分钟执行一次，移除没有活跃连接的房间
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 300_000)
    public void cleanupStaleRooms() {
        int removed = 0;
        Iterator<Map.Entry<String, Set<WebSocketSession>>> it = ROOM_SESSIONS.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Set<WebSocketSession>> entry = it.next();
            entry.getValue().removeIf(s -> !s.isOpen());
            if (entry.getValue().isEmpty()) {
                it.remove();
                removed++;
            }
        }
        if (removed > 0) {
            log.info("WebSocket 定时清理: 移除 {} 个空房间", removed);
        }
    }

    private String getRoomId(WebSocketSession session) {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && "roomId".equals(kv[0])) {
                return kv[1];
            }
        }
        return null;
    }
}
