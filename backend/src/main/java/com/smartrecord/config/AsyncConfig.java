package com.smartrecord.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SimpleAsyncTaskExecutor;

import java.util.concurrent.Executor;

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
        SimpleAsyncTaskExecutor executor = new SimpleAsyncTaskExecutor("vt-async-");
        // 开启 JDK 21 虚拟线程支持
        executor.setVirtualThreads(true);
        // 配置跨线程 MDC 日志链追踪复制装饰器
        executor.setTaskDecorator(new MdcTaskDecorator());
        return executor;
    }
}
