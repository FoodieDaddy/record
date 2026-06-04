package com.smartrecord.service;

import com.smartrecord.dto.storage.BatchPresignReq;
import com.smartrecord.dto.storage.PresignUrlResp;

import java.util.List;

public interface StorageService {

    PresignUrlResp generatePresignUrl(String contentType);

    List<PresignUrlResp> batchGeneratePresignUrls(BatchPresignReq req);

    /**
     * 异步删除 OSS 文件
     */
    void deleteObjectAsync(String objectKey);

    /**
     * 将 objectKey 拼接为完整访问 URL
     */
    String buildFullUrl(String objectKey);
}
