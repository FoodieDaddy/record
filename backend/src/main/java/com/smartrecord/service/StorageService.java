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
}
