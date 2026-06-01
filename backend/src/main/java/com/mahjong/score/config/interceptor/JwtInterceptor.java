package com.mahjong.score.config.interceptor;

import com.mahjong.score.common.BizException;
import com.mahjong.score.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class JwtInterceptor implements HandlerInterceptor {

    public static final String USER_ID_ATTR = "currentUserId";

    private final JwtUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String token = request.getHeader("Authorization");
        if (token == null || !token.startsWith("Bearer ")) {
            throw new BizException(401, "未登录");
        }
        try {
            Long userId = jwtUtil.parseUserId(token.substring(7));
            request.setAttribute(USER_ID_ATTR, userId);
            return true;
        } catch (Exception e) {
            throw new BizException(401, "登录已过期");
        }
    }
}
