package com.smartrecord.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 应用配置属性
 * 集中管理 JWT、OSS 等关键配置，便于生产环境 fail-fast 校验
 */
@Data
@Validated
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Oss oss = new Oss();

    @Data
    public static class Jwt {
        private String secret;
    }

    @Data
    public static class Oss {
        private String endpoint;
        private String accessKeyId;
        private String accessKeySecret;
        private String bucketName;
    }
}
