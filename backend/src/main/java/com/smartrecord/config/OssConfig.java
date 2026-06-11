package com.smartrecord.config;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "app.oss")
public class OssConfig {

    private String endpoint;
    private String accessKeyId;
    private String accessKeySecret;
    private String bucketName;

    @Bean
    @ConditionalOnProperty(name = "storage.provider", havingValue = "aliyun")
    public OSS ossClient() {
        OSS client = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        log.info("阿里云 OSS 客户端初始化完成, bucket={}", bucketName);
        return client;
    }
}
