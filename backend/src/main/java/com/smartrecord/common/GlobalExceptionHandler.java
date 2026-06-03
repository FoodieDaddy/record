package com.smartrecord.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.connection.PoolException;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public Result<Void> handleBiz(BizException e) {
        log.warn("业务异常: {}", e.getMessage());
        return Result.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("参数校验失败");
        return Result.fail(400, msg);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleBind(BindException e) {
        String msg = e.getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("参数绑定失败");
        return Result.fail(400, msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleConstraint(ConstraintViolationException e) {
        return Result.fail(400, e.getMessage());
    }

    /**
     * Redis 连接失败（Redis 重启、网络闪断）
     */
    @ExceptionHandler(RedisConnectionFailureException.class)
    public Result<Void> handleRedisConnection(RedisConnectionFailureException e) {
        log.error("Redis 连接失败: {}", e.getMessage());
        return degradeResponse();
    }

    /**
     * Redis 查询超时
     */
    @ExceptionHandler(QueryTimeoutException.class)
    public Result<Void> handleRedisTimeout(QueryTimeoutException e) {
        log.error("Redis 查询超时: {}", e.getMessage());
        return degradeResponse();
    }

    /**
     * Redis 底层系统异常（序列化失败、脚本执行错误等）
     */
    @ExceptionHandler(RedisSystemException.class)
    public Result<Void> handleRedisSystem(RedisSystemException e) {
        log.error("Redis 系统异常: {}", e.getMessage());
        return degradeResponse();
    }

    /**
     * Redis 连接池耗尽
     */
    @ExceptionHandler(PoolException.class)
    public Result<Void> handleRedisPool(PoolException e) {
        log.error("Redis 连接池异常: {}", e.getMessage());
        return degradeResponse();
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return Result.fail(500, "服务器内部错误");
    }

    private Result<Void> degradeResponse() {
        return Result.fail(503, "服务器正在进行极速快照同步，请稍等片刻后再试~");
    }
}
