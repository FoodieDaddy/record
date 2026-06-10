package com.smartrecord.aop;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 幂等注解，标记在需要防重复提交的 Controller 方法上。
 * 切面会根据 userId + operation + clientRequestId 生成幂等键，
 * 通过 Redis SETNX 实现请求去重。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotent {

    /** 操作类型标识 */
    String operation();

    /** 幂等键过期时间（秒），默认 600（10分钟） */
    long expireSeconds() default 600;
}
