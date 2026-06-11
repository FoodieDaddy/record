package com.smartrecord.config;

import com.smartrecord.service.impl.ws.WebSocketRedisSubscriber;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * WebSocket 分布式 Pub/Sub 广播消息订阅容器配置类。
 * 负责组装 RedisMessageListenerContainer，监听指定的 ws 广播主题。
 */
@Configuration
public class WebSocketRedisConfig {

    @Bean
    public RedisMessageListenerContainer webSocketRedisContainer(RedisConnectionFactory connectionFactory,
                                                                 WebSocketRedisSubscriber subscriber) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(subscriber, new PatternTopic("sr:ws:pubsub"));
        return container;
    }
}
