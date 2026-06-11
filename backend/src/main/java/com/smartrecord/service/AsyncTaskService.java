package com.smartrecord.service;

import com.smartrecord.entity.AsyncTask;

import java.util.List;

/**
 * 异步任务服务接口
 */
public interface AsyncTaskService {

    /**
     * 创建任务（利用唯一键防重复）
     *
     * @param taskType 任务类型
     * @param bizKey   业务唯一键
     * @param payload  任务参数（JSON 字符串）
     */
    void createTask(String taskType, String bizKey, String payload);

    /**
     * 获取待执行任务
     *
     * @param taskType 任务类型
     * @param limit    最大返回数量
     * @return 待执行任务列表
     */
    List<AsyncTask> fetchPendingTasks(String taskType, int limit);

    /**
     * 标记任务成功
     *
     * @param taskId 任务 ID
     */
    void markSuccess(Long taskId);

    /**
     * 标记任务失败，更新 retryCount 和 nextRunAt
     *
     * @param taskId 任务 ID
     * @param error  错误信息
     */
    void markFailed(Long taskId, String error);

    /**
     * 原子抢占异步任务（乐观锁状态变更）
     *
     * @param taskId 任务 ID
     * @return 抢占成功返回 true，否则返回 false
     */
    boolean startTask(Long taskId);
}
