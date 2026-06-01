package com.mahjong.score.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.SetBucketPolicyArgs;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;

@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "app.minio")
public class MinioConfig {

    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String bucket;

    private MinioClient client;

    @Bean
    public MinioClient minioClient() {
        this.client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        return this.client;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initBucket() {
        if (client == null) return;
        try {
            boolean exists = client.bucketExists(
                    BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                client.makeBucket(
                        MakeBucketArgs.builder().bucket(bucket).build());
                String policy = String.format("""
                        {
                          "Version": "2012-10-17",
                          "Statement": [{
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": ["arn:aws:s3:::%s/*"]
                          }]
                        }
                        """, bucket);
                client.setBucketPolicy(
                        SetBucketPolicyArgs.builder().bucket(bucket).config(policy).build());
                log.info("MinIO bucket [{}] 已创建并设置公开读策略", bucket);
            } else {
                log.info("MinIO bucket [{}] 已存在", bucket);
            }
        } catch (Exception e) {
            log.warn("MinIO bucket 初始化失败（可能 MinIO 未启动）: {}", e.getMessage());
        }
    }
}
