package com.smartrecord.service.impl.ws;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartrecord.util.JwtUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import org.springframework.web.socket.WebSocketHttpHeaders;

import java.util.Iterator;
import java.util.List;
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

    private static final String USER_ID_ATTR = "userId";

    /** roomId -> set of sessions */
    private static final Map<String, Set<WebSocketSession>> ROOM_SESSIONS = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final JwtUtil jwtUtil;

    public ScoreWebSocket(StringRedisTemplate redisTemplate, ObjectMapper objectMapper, JwtUtil jwtUtil) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // 1. 校验 token
        Long userId = authenticateSession(session);
        if (userId == null) {
            return;
        }

        // 2. 提取 roomId
        String roomId = getRoomId(session);
        if (roomId == null) {
            try { session.close(); } catch (Exception ignored) {}
            return;
        }

        // 3. 关联 userId 到 session
        session.getAttributes().put(USER_ID_ATTR, userId);
        ROOM_SESSIONS.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("WebSocket 连接建立: roomId={}, userId={}, sessionId={}", roomId, userId, session.getId());
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
     * 踢出指定用户的所有 WebSocket 连接（封禁/注销时调用）
     */
    public void kickUser(Long userId) {
        int kicked = 0;
        for (Map.Entry<String, Set<WebSocketSession>> entry : ROOM_SESSIONS.entrySet()) {
            Iterator<WebSocketSession> it = entry.getValue().iterator();
            while (it.hasNext()) {
                WebSocketSession session = it.next();
                Object sid = session.getAttributes().get(USER_ID_ATTR);
                if (sid != null && sid.equals(userId)) {
                    try {
                        session.close(new CloseStatus(4003, "账号异常"));
                    } catch (Exception ignored) {}
                    it.remove();
                    kicked++;
                }
            }
        }
        if (kicked > 0) {
            log.info("WebSocket 踢出用户: userId={}, 关闭 {} 个连接", userId, kicked);
        }
    }

    /**
     * 校验 WebSocket 连接的 token 和用户状态
     * @return userId 校验通过返回 userId，失败返回 null 并关闭 session
     */
    private Long authenticateSession(WebSocketSession session) {
        String token = getToken(session);
        if (token == null) {
            closeSession(session, 4001, "缺少认证信息");
            return null;
        }

        Long userId;
        try {
            userId = jwtUtil.parseUserId(token);
        } catch (Exception e) {
            closeSession(session, 4001, "认证已过期");
            return null;
        }

        // 检查用户状态
        String userKey = "sr:user:" + userId;
        String cachedJson = redisTemplate.opsForValue().get(userKey);
        if (cachedJson != null) {
            JSONObject obj = JSONUtil.parseObj(cachedJson);
            int status = obj.getInt("status", 0);
            if (status == 1) {
                closeSession(session, 4003, "账号已被封禁");
                return null;
            }
            if (status == 2) {
                closeSession(session, 4003, "账号已注销");
                return null;
            }
        }
        // 缓存未命中时不阻断（JWT 已验证），由 HTTP 层拦截器兜底

        return userId;
    }

    private void closeSession(WebSocketSession session, int code, String reason) {
        try {
            session.close(new CloseStatus(code, reason));
        } catch (Exception ignored) {}
    }

    private String getToken(WebSocketSession session) {
        // 优先从 Sec-WebSocket-Protocol 头提取（格式：access_token.<jwt>）
        List<String> protocols = session.getHandshakeHeaders()
                .get("Sec-WebSocket-Protocol");
        if (protocols != null) {
            for (String proto : protocols) {
                for (String part : proto.split(",")) {
                    String trimmed = part.trim();
                    if (trimmed.startsWith("access_token.")) {
                        return trimmed.substring("access_token.".length());
                    }
                }
            }
        }
        // 降级：从 query parameter 提取（兼容旧版客户端）
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && "token".equals(kv[0])) {
                return kv[1];
            }
        }
        return null;
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
