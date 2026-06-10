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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 心跳配置
 */
import org.springframework.web.socket.PingMessage;
import java.nio.ByteBuffer;

/**
 * WebSocket 推送记分实时同步
 * 前端连接：房间维度 WebSocket，旧客户端可通过 query token 兼容接入
 * 房间内任意玩家记分后，推送更新给同房间所有玩家
 */
@Slf4j
@Component
public class ScoreWebSocket extends TextWebSocketHandler {

    private static final String USER_ID_ATTR = "userId";
    private static final String ROOM_PREFIX = "sr:room:";

    /** roomId -> set of sessions */
    private static final Map<String, Set<WebSocketSession>> ROOM_SESSIONS = new ConcurrentHashMap<>();

    /** session id -> 最后活跃时间戳 */
    private static final Map<String, Long> LAST_ACTIVE = new ConcurrentHashMap<>();

    /** 心跳超时：60 秒无响应视为僵尸连接 */
    private static final long HEARTBEAT_TIMEOUT_MS = 60_000;

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

        // 3. 校验用户是否为该房间的活跃成员
        if (!isActiveRoomMember(roomId, userId)) {
            closeSession(session, 4003, "无权访问该编队");
            log.warn("WebSocket 成员校验失败: roomId={}, userId={}", roomId, userId);
            return;
        }

        // 4. 关联 userId 到 session
        session.getAttributes().put(USER_ID_ATTR, userId);
        ROOM_SESSIONS.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
        LAST_ACTIVE.put(session.getId(), System.currentTimeMillis());
        log.info("WebSocket 连接建立: roomId={}, userId={}, sessionId={}", roomId, userId, session.getId());
        pushPresence(roomId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // 更新活跃时间，客户端发任何消息都视为心跳
        LAST_ACTIVE.put(session.getId(), System.currentTimeMillis());

        // 如果客户端发了文本 "PONG"，静默处理
        String payload = message.getPayload();
        if ("PONG".equals(payload)) {
            return;
        }
        // 其他文本消息暂不处理（当前协议只有服务端推送）
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, org.springframework.web.socket.PongMessage message) {
        // 原生 pong 帧响应
        LAST_ACTIVE.put(session.getId(), System.currentTimeMillis());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        LAST_ACTIVE.remove(session.getId());
        String roomId = getRoomId(session);
        if (roomId != null) {
            Set<WebSocketSession> sessions = ROOM_SESSIONS.get(roomId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    ROOM_SESSIONS.remove(roomId);
                }
                pushPresence(roomId);
            }
        }
    }

    private void pushPresence(String roomId) {
        Set<WebSocketSession> sessions = ROOM_SESSIONS.get(roomId);
        List<String> onlineUserIds = new ArrayList<>();
        if (sessions != null) {
            sessions.stream()
                    .filter(WebSocketSession::isOpen)
                    .map(s -> s.getAttributes().get(USER_ID_ATTR))
                    .filter(Long.class::isInstance)
                    .map(String::valueOf)
                    .distinct()
                    .forEach(onlineUserIds::add);
        }
        pushToRoom(roomId, Map.of(
                "type", "PRESENCE_UPDATE",
                "roomId", roomId,
                "onlineUserIds", onlineUserIds
        ));
    }

    /**
     * 向房间内所有连接推送消息
     * 自动为 Map 类型消息添加 messageId、serverTime、roomId 信封字段
     */
    public void pushToRoom(String roomId, Object message) {
        Set<WebSocketSession> sessions = ROOM_SESSIONS.get(roomId);
        if (sessions == null || sessions.isEmpty()) return;

        // 为消息添加统一信封字段
        Object enrichedMessage = enrichMessage(message, roomId);

        String payload;
        try {
            payload = objectMapper.writeValueAsString(enrichedMessage);
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
     * 为消息添加统一信封字段
     * 仅对 Map 类型消息生效，使用 putIfAbsent 避免覆盖已有字段
     */
    @SuppressWarnings("unchecked")
    private Object enrichMessage(Object message, String roomId) {
        if (message instanceof Map) {
            Map<String, Object> map = new LinkedHashMap<>((Map<String, Object>) message);
            map.putIfAbsent("messageId", java.util.UUID.randomUUID().toString().replace("-", ""));
            map.putIfAbsent("serverTime", System.currentTimeMillis());
            map.putIfAbsent("roomId", roomId);
            return map;
        }
        return message;
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
        Object cached = redisTemplate.opsForHash().get("sr:user:" + userId, "info");
        if (cached != null) {
            JSONObject obj = JSONUtil.parseObj((String) cached);
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
     * 定时心跳：每 25 秒向所有连接发送 PING
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 25_000)
    public void sendHeartbeat() {
        long now = System.currentTimeMillis();
        int pinged = 0;
        int closed = 0;

        for (Map.Entry<String, Set<WebSocketSession>> entry : ROOM_SESSIONS.entrySet()) {
            for (WebSocketSession session : entry.getValue()) {
                if (!session.isOpen()) continue;

                Long lastActive = LAST_ACTIVE.get(session.getId());
                // 超过 60 秒无响应，关闭僵尸连接
                if (lastActive != null && now - lastActive > HEARTBEAT_TIMEOUT_MS) {
                    try {
                        session.close(new CloseStatus(4001, "心跳超时"));
                    } catch (Exception ignored) {}
                    closed++;
                    continue;
                }

                // 发送 PING
                try {
                    session.sendMessage(new PingMessage(ByteBuffer.wrap(new byte[0])));
                    pinged++;
                } catch (Exception e) {
                    log.warn("WebSocket PING 发送失败: {}", session.getId());
                }
            }
        }

        if (closed > 0) {
            log.info("WebSocket 心跳清理: 关闭 {} 个僵尸连接", closed);
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
            entry.getValue().removeIf(s -> {
                if (!s.isOpen()) {
                    LAST_ACTIVE.remove(s.getId());
                    return true;
                }
                return false;
            });
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

    /**
     * 判断用户是否为房间活跃成员（data Hash 的 a: 前缀字段）
     */
    private boolean isActiveRoomMember(String roomId, Long userId) {
        String dataKey = ROOM_PREFIX + roomId + ":data";
        return Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(dataKey, "a:" + userId));
    }
}
