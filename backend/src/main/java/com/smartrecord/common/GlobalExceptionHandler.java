package com.smartrecord.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.connection.PoolException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public ResponseEntity<Result<Void>> handleBiz(BizException e) {
        log.warn("业务异常: {}", e.getMessage());
        int code = e.getCode();
        HttpStatus status = HttpStatus.OK;
        if (code == 401 || code == 4001 || code == 4002 || code == 4004) {
            status = HttpStatus.UNAUTHORIZED;
        } else if (code == 403 || code == 4003 || code == 4005 || (code >= 4031 && code <= 4038)) {
            status = HttpStatus.FORBIDDEN;
        } else if (code == 400) {
            status = HttpStatus.BAD_REQUEST;
        }
        return new ResponseEntity<>(Result.fail(e.getCode(), e.getMessage()), status);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Result<Void>> handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("请求体解析失败: {}", e.getMessage());
        return new ResponseEntity<>(Result.fail(400, "请求格式错误"), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("参数校验失败");
        return new ResponseEntity<>(Result.fail(400, msg), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<Result<Void>> handleBind(BindException e) {
        String msg = e.getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("参数绑定失败");
        return new ResponseEntity<>(Result.fail(400, msg), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Result<Void>> handleConstraint(ConstraintViolationException e) {
        return new ResponseEntity<>(Result.fail(400, e.getMessage()), HttpStatus.BAD_REQUEST);
    }

    /**
     * Redis 连接失败（Redis 重启、网络闪断）
     */
    @ExceptionHandler(RedisConnectionFailureException.class)
    public ResponseEntity<Result<Void>> handleRedisConnection(RedisConnectionFailureException e) {
        log.error("Redis 连接失败: {}", e.getMessage());
        return new ResponseEntity<>(degradeResponse(), HttpStatus.SERVICE_UNAVAILABLE);
    }

    /**
     * Redis 查询超时
     */
    @ExceptionHandler(QueryTimeoutException.class)
    public ResponseEntity<Result<Void>> handleRedisTimeout(QueryTimeoutException e) {
        log.error("Redis 查询超时: {}", e.getMessage());
        return new ResponseEntity<>(degradeResponse(), HttpStatus.SERVICE_UNAVAILABLE);
    }

    /**
     * Redis 底层系统异常（序列化失败、脚本执行错误等）
     */
    @ExceptionHandler(RedisSystemException.class)
    public ResponseEntity<Result<Void>> handleRedisSystem(RedisSystemException e) {
        log.error("Redis 系统异常: {}", e.getMessage());
        return new ResponseEntity<>(degradeResponse(), HttpStatus.SERVICE_UNAVAILABLE);
    }

    /**
     * Redis 连接池耗尽
     */
    @ExceptionHandler(PoolException.class)
    public ResponseEntity<Result<Void>> handleRedisPool(PoolException e) {
        log.error("Redis 连接池异常: {}", e.getMessage());
        return new ResponseEntity<>(degradeResponse(), HttpStatus.SERVICE_UNAVAILABLE);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleException(Exception e) {
        log.error("系统异常", e);
        return new ResponseEntity<>(Result.fail(500, "服务器内部错误"), HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private Result<Void> degradeResponse() {
        return Result.fail(503, "服务器正在进行极速快照同步，请稍等片刻后再试~");
    }
}
