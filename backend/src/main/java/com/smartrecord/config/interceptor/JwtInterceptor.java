package com.smartrecord.config.interceptor;

import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * JWT 鉴权拦截器 — 纯内存验签，零查库
 * 仅校验 Token 签名与有效期，解析 userId 写入请求属性。
 * 用户状态（封禁/注销）由具体业务 Service 在需要时自行校验。
 */
@Slf4j
@Component
public class JwtInterceptor implements HandlerInterceptor {

    public static final String USER_ID_ATTR = "currentUserId";

    private final JwtUtil jwtUtil;

    public JwtInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String token = request.getHeader("Authorization");
        if (token == null || !token.startsWith("Bearer ")) {
            throw new BizException(ErrorCode.IDENTITY_NOT_FOUND);
        }
        try {
            Long userId = jwtUtil.parseUserId(token.substring(7));
            request.setAttribute(USER_ID_ATTR, userId);
            return true;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException(ErrorCode.IDENTITY_EXPIRED);
        }
    }
}
