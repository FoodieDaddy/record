package com.smartrecord.config;

import com.smartrecord.service.impl.ws.ScoreWebSocket;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.util.List;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private static final String ACCESS_TOKEN_PROTOCOL_PREFIX = "access_token.";

    private final ScoreWebSocket scoreWebSocket;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(scoreWebSocket, "/ws/score")
                .setHandshakeHandler(accessTokenHandshakeHandler())
                .setAllowedOrigins(
                        "https://servicewechat.com",
                        "http://localhost:18080"
                );
    }

    private DefaultHandshakeHandler accessTokenHandshakeHandler() {
        return new DefaultHandshakeHandler() {
            @Override
            protected String selectProtocol(List<String> requestedProtocols, WebSocketHandler webSocketHandler) {
                if (requestedProtocols != null) {
                    for (String protocol : requestedProtocols) {
                        // 小程序把 JWT 放在子协议中；服务端必须回选该协议，否则客户端会判定握手失败。
                        if (protocol != null && protocol.startsWith(ACCESS_TOKEN_PROTOCOL_PREFIX)) {
                            return protocol;
                        }
                    }
                }
                return super.selectProtocol(requestedProtocols, webSocketHandler);
            }
        };
    }
}
