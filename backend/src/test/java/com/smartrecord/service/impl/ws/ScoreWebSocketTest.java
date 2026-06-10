package com.smartrecord.service.impl.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartrecord.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class ScoreWebSocketTest {

    @Test
    @DisplayName("enrichMessage：可安全处理不可变 Map 并补充信封字段")
    void enrichMessage_shouldCopyImmutableMap() {
        ScoreWebSocket webSocket = new ScoreWebSocket(
                mock(StringRedisTemplate.class),
                new ObjectMapper(),
                mock(JwtUtil.class)
        );

        Map<String, Object> original = Map.of(
                "type", "PRESENCE_UPDATE",
                "roomId", "room-1"
        );

        Object result = ReflectionTestUtils.invokeMethod(webSocket, "enrichMessage", original, "room-1");
        assertInstanceOf(Map.class, result);

        @SuppressWarnings("unchecked")
        Map<String, Object> enriched = (Map<String, Object>) result;
        assertEquals("PRESENCE_UPDATE", enriched.get("type"));
        assertEquals("room-1", enriched.get("roomId"));
        assertNotNull(enriched.get("messageId"));
        assertNotNull(enriched.get("serverTime"));
        assertDoesNotThrow(() -> original.get("type"));
    }
}
