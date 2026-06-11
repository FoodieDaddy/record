package com.smartrecord.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 通用存储 Provider 配置
 *
 * storage.provider 支持以下值：
 *   aliyun    阿里云 OSS（默认，兼容现有配置）
 *   cloudbase 腾讯云开发 CloudBase（开发测试阶段，前端直传 wx.cloud）
 *   cos       腾讯云 COS（后期预留）
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "storage")
public class StorageProviderConfig {

    /** 当前存储提供者：cloudbase（默认）/ aliyun / cos */
    private String provider = "cloudbase";

    /** CloudBase 环境配置 */
    private CloudBase cloudbase = new CloudBase();

    /** COS 环境配置（预留） */
    private Cos cos = new Cos();

    @Data
    public static class CloudBase {
        /** CloudBase 环境 ID */
        private String envId;
    }

    @Data
    public static class Cos {
        private String bucket;
        private String region;
        private String secretId;
        private String secretKey;
    }
}
