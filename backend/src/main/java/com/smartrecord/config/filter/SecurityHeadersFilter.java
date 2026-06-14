package com.smartrecord.config.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.lang.NonNull;

import java.io.IOException;

/**
 * 为所有 HTTP 响应注入安全相关的响应头。
 * Order(HIGHEST_PRECEDENCE) 确保在其他过滤器之前执行。
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        // 防止浏览器 MIME 类型嗅探
        response.setHeader("X-Content-Type-Options", "nosniff");

        // 禁止页面被嵌入 iframe（防止 Clickjacking）
        response.setHeader("X-Frame-Options", "DENY");

        // 启用浏览器 XSS 过滤器（旧浏览器支持）
        response.setHeader("X-XSS-Protection", "1; mode=block");

        // 控制 Referer 信息泄露：同源时发送完整 URL，跨域仅发送 origin
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

        // 禁用浏览器功能探测权限（摄像头、麦克风等）
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

        // 缓存控制：敏感页面不缓存
        response.setHeader("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");

        filterChain.doFilter(request, response);
    }
}
