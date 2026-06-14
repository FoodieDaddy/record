package com.smartrecord.config;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.lang.NonNull;

import java.util.Map;

/**
 * MDC 跨线程上下文传递装饰器，用于在提交给异步线程池时跨线程复制主线程的 MDC 请求追踪 ID。
 */
public class MdcTaskDecorator implements TaskDecorator {

    @Override
    @NonNull
    public Runnable decorate(@NonNull Runnable runnable) {
        // 获取当前主线程的 MDC 上下文复制
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        return () -> {
            try {
                // 将父线程的 MDC 上下文绑定到当前子线程中
                if (contextMap != null) {
                    MDC.setContextMap(contextMap);
                }
                runnable.run();
            } finally {
                // 运行完毕，清空当前线程的 MDC
                MDC.clear();
            }
        };
    }
}
