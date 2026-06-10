package com.smartrecord.aop;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartrecord.aop.Idempotent;
import com.smartrecord.common.Result;
import com.smartrecord.service.IdempotencyService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

/**
 * 幂等切面 — 拦截 @Idempotent 注解的方法，实现请求去重
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class IdempotentAspect {

    private final HttpServletRequest request;
    private final IdempotencyService idempotencyService;
    private final ObjectMapper objectMapper;

    @Around("@annotation(idempotent)")
    public Object around(ProceedingJoinPoint joinPoint, Idempotent idempotent) throws Throwable {
        // 获取当前用户 ID（由 JwtInterceptor 设置）
        Long userId = (Long) request.getAttribute("currentUserId");
        if (userId == null) {
            return joinPoint.proceed();
        }

        // 从方法参数中查找 clientRequestId 字段
        String clientRequestId = extractClientRequestId(joinPoint.getArgs());

        // clientRequestId 为空时跳过幂等检查
        if (clientRequestId == null || clientRequestId.isBlank()) {
            return joinPoint.proceed();
        }

        String operation = idempotent.operation();
        long expireSeconds = idempotent.expireSeconds();

        String cached = idempotencyService.checkAndLock(
                String.valueOf(userId), operation, clientRequestId, expireSeconds);

        if (cached == null) {
            // 首次请求，正常执行
            Object result = joinPoint.proceed();
            try {
                String resultJson = objectMapper.writeValueAsString(result);
                idempotencyService.markSuccess(
                        String.valueOf(userId), operation, clientRequestId, resultJson, expireSeconds);
            } catch (Exception e) {
                log.warn("幂等结果序列化失败: operation={}, error={}", operation, e.getMessage());
            }
            return result;
        }

        if ("PROCESSING".equals(cached)) {
            // 正在处理中
            return Result.fail(409, "请求正在处理中，请勿重复提交");
        }

        // 已缓存的结果，直接返回
        try {
            return objectMapper.readValue(cached, new TypeReference<Result<?>>() {});
        } catch (Exception e) {
            log.warn("幂等结果反序列化失败: cached={}, error={}", cached, e.getMessage());
            return Result.fail(409, "请求正在处理中，请勿重复提交");
        }
    }

    /**
     * 通过反射从参数对象中提取 clientRequestId
     */
    private String extractClientRequestId(Object[] args) {
        if (args == null) {
            return null;
        }
        for (Object arg : args) {
            if (arg == null) {
                continue;
            }
            try {
                Method method = arg.getClass().getMethod("getClientRequestId");
                Object value = method.invoke(arg);
                if (value instanceof String str) {
                    return str;
                }
            } catch (NoSuchMethodException ignored) {
                // 参数对象没有 getClientRequestId 方法，跳过
            } catch (Exception e) {
                log.debug("提取 clientRequestId 失败: {}", e.getMessage());
            }
        }
        return null;
    }
}
