package com.smartrecord.service;

import com.smartrecord.dto.storage.PresignUrlResp;

public interface StorageService {

    PresignUrlResp generatePresignUrl(String contentType, Long contentLength);

    /**
     * 异步删除存储文件
     */
    void deleteObjectAsync(String objectKey);

    /**
     * 将 objectKey 拼接为完整访问 URL。
     * 对于 cloud:// 开头的 fileID 直接返回原值（前端自行解析）。
     */
    String buildFullUrl(String objectKey);

    /**
     * 获取当前存储提供者标识：aliyun / cloudbase / cos
     */
    String getProvider();
}
