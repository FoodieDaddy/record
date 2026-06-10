package com.smartrecord.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.entity.AsyncTask;
import com.smartrecord.mapper.AsyncTaskMapper;
import com.smartrecord.service.AsyncTaskService;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 异步任务服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AsyncTaskServiceImpl implements AsyncTaskService {

    private final AsyncTaskMapper asyncTaskMapper;
    private final SnowflakeIdGenerator idGenerator;

    /** 最大重试次数 */
    private static final int DEFAULT_MAX_RETRY = 5;

    /** 最大退避时间（秒）：1 小时 */
    private static final int MAX_BACKOFF_SECONDS = 3600;

    /** 基础退避时间（秒）：60 秒 */
    private static final int BASE_BACKOFF_SECONDS = 60;

    @Override
    public void createTask(String taskType, String bizKey, String payload) {
        try {
            AsyncTask task = new AsyncTask();
            task.setId(idGenerator.nextId());
            task.setTaskType(taskType);
            task.setBizKey(bizKey);
            task.setPayload(payload);
            task.setStatus(0); // pending
            task.setRetryCount(0);
            task.setMaxRetry(DEFAULT_MAX_RETRY);
            task.setNextRunAt(LocalDateTime.now());
            asyncTaskMapper.insert(task);
            log.info("创建异步任务成功: taskType={}, bizKey={}", taskType, bizKey);
        } catch (DuplicateKeyException e) {
            // 唯一键冲突，静默忽略（任务已存在）
            log.debug("异步任务已存在，跳过创建: taskType={}, bizKey={}", taskType, bizKey);
        }
    }

    @Override
    public List<AsyncTask> fetchPendingTasks(String taskType, int limit) {
        return asyncTaskMapper.selectList(
                new LambdaQueryWrapper<AsyncTask>()
                        .eq(AsyncTask::getTaskType, taskType)
                        .in(AsyncTask::getStatus, 0, 3) // pending 或 failed
                        .le(AsyncTask::getNextRunAt, LocalDateTime.now())
                        .apply("retry_count < max_retry")
                        .orderByAsc(AsyncTask::getNextRunAt)
                        .last("LIMIT " + limit)
        );
    }

    @Override
    public void markSuccess(Long taskId) {
        asyncTaskMapper.update(null,
                new LambdaUpdateWrapper<AsyncTask>()
                        .eq(AsyncTask::getId, taskId)
                        .set(AsyncTask::getStatus, 2) // success
        );
    }

    @Override
    public void markFailed(Long taskId, String error) {
        // 先查询当前任务获取 retryCount
        AsyncTask task = asyncTaskMapper.selectById(taskId);
        if (task == null) {
            log.warn("标记失败时找不到任务: taskId={}", taskId);
            return;
        }

        int newRetryCount = task.getRetryCount() + 1;
        boolean exhausted = newRetryCount >= task.getMaxRetry();

        // 指数退避：base * 2^retryCount，最大 1 小时
        int backoffSeconds = Math.min(
                BASE_BACKOFF_SECONDS * (1 << Math.min(newRetryCount, 10)),
                MAX_BACKOFF_SECONDS
        );
        LocalDateTime nextRunAt = LocalDateTime.now().plusSeconds(backoffSeconds);

        asyncTaskMapper.update(null,
                new LambdaUpdateWrapper<AsyncTask>()
                        .eq(AsyncTask::getId, taskId)
                        .set(AsyncTask::getStatus, exhausted ? 3 : 0) // 超过最大重试保持 failed，否则重置为 pending
                        .set(AsyncTask::getRetryCount, newRetryCount)
                        .set(AsyncTask::getLastError, truncateError(error))
                        .set(AsyncTask::getNextRunAt, nextRunAt)
        );

        if (exhausted) {
            log.warn("异步任务已达到最大重试次数: taskId={}, retryCount={}", taskId, newRetryCount);
        } else {
            log.info("异步任务标记失败，将在 {} 秒后重试: taskId={}, retryCount={}", backoffSeconds, taskId, newRetryCount);
        }
    }

    /**
     * 截断错误信息，避免超过字段长度限制
     */
    private String truncateError(String error) {
        if (error == null) {
            return null;
        }
        return error.length() > 1024 ? error.substring(0, 1024) : error;
    }
}
