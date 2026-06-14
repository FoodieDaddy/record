package com.smartrecord.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.EnvironmentAware;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.lang.NonNull;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 生产环境配置校验
 * 在 prod profile 激活时，检查所有关键配置是否已填写。
 * 缺少任何必要配置时立即抛出 IllegalStateException，阻止应用启动。
 */
@Slf4j
@Configuration
@EnableConfigurationProperties({AppProperties.class, SnowflakeProperties.class})
public class ConfigValidationRunner implements EnvironmentAware {

    private Environment environment;

    @Override
    public void setEnvironment(@NonNull Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validateConfig() {
        String[] activeProfiles = environment.getActiveProfiles();
        boolean isProd = Arrays.asList(activeProfiles).contains("prod");
        if (!isProd) {
            return;
        }

        List<String> missing = new ArrayList<>();

        // JWT 密钥
        checkProperty("app.jwt.secret", missing);

        // 微信小程序
        checkProperty("wechat.appid", missing);
        checkProperty("wechat.secret", missing);

        // OSS 存储
        checkProperty("app.oss.endpoint", missing);
        checkProperty("app.oss.access-key-id", missing);
        checkProperty("app.oss.access-key-secret", missing);
        checkProperty("app.oss.bucket-name", missing);

        // Snowflake ID
        checkProperty("app.snowflake.data-center-id", missing);
        checkProperty("app.snowflake.worker-id", missing);

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                "Prod 环境缺少必填配置: " + String.join(", ", missing)
            );
        }

        log.info("Prod 配置校验通过");
    }

    /**
     * 检查单个配置项是否为空或空白
     */
    private void checkProperty(@NonNull String key, @NonNull List<String> missing) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) {
            missing.add(key);
        }
    }
}
