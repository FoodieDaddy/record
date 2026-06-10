package com.smartrecord.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Snowflake ID生成器配置
 */
@Data
@Validated
@ConfigurationProperties(prefix = "app.snowflake")
public class SnowflakeProperties {

    /**
     * 数据中心ID (0-31)
     */
    @Min(0)
    @Max(31)
    private Integer dataCenterId;

    /**
     * 工作节点ID (0-31)
     */
    @Min(0)
    @Max(31)
    private Integer workerId;
}
