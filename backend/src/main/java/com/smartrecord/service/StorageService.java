package com.smartrecord.service;

import com.smartrecord.dto.storage.PresignUrlResp;

public interface StorageService {

    PresignUrlResp generatePresignUrl(String contentType, Long contentLength);

    /**
     * 异步删除 OSS 文件
     */
    void deleteObjectAsync(String objectKey);

    /**
     * 将 objectKey 拼接为完整访问 URL
     */
    String buildFullUrl(String objectKey);
}
