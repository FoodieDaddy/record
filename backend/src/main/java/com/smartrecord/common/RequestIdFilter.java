package com.smartrecord.common;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * 请求追踪与耗时预警监控过滤器
 * 为每个请求生成唯一 requestId 写入 MDC 和响应头，并监控测算慢请求。
 */
@Slf4j
@Component
public class RequestIdFilter implements Filter {

    private static final String HEADER = "X-Request-Id";
    private static final String MDC_KEY = "requestId";
    
    // 慢请求监控预警阈值：800ms
    private static final long SLOW_THRESHOLD_MS = 800;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpRes = (HttpServletResponse) response;

        String requestId = httpReq.getHeader(HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }

        MDC.put(MDC_KEY, requestId);
        httpRes.setHeader(HEADER, requestId);

        long startTime = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
        } finally {
            long costTime = System.currentTimeMillis() - startTime;
            if (costTime > SLOW_THRESHOLD_MS) {
                log.warn("[SLOW REQUEST DETECTED] 慢接口报警: method={}, uri={}, cost={}ms",
                        httpReq.getMethod(), httpReq.getRequestURI(), costTime);
            } else {
                log.debug("请求执行完成: method={}, uri={}, cost={}ms",
                        httpReq.getMethod(), httpReq.getRequestURI(), costTime);
            }
            MDC.remove(MDC_KEY);
        }
    }
}
