package com.smartrecord.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * 异步线程池配置 — 基于 JDK 21 虚拟线程
 *
 * 虚拟线程在阻塞 I/O（Redis、网络推送、OSS）时自动卸载载体线程，
 * 无数量限制，2C2G 环境下可并发处理大量异步任务而不会耗尽平台线程。
 */
@Configuration
public class AsyncConfig {

    @Bean("asyncExecutor")
    public Executor asyncExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
