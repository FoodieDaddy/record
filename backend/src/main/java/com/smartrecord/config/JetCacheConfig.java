package com.smartrecord.config;

import com.alicp.jetcache.anno.config.EnableCreateCacheAnnotation;
import com.alicp.jetcache.anno.config.EnableMethodCache;
import org.springframework.context.annotation.Configuration;

/**
 * JetCache 二级缓存配置类。
 * 激活注解式方法缓存（@Cached 等）以及创建缓存对象注解（@CreateCache）。
 */
@Configuration
@EnableMethodCache(basePackages = "com.smartrecord")
@SuppressWarnings("deprecation")
@EnableCreateCacheAnnotation
public class JetCacheConfig {
}
