package com.mahjong.score.service;

import com.mahjong.score.dto.storage.BatchPresignReq;
import com.mahjong.score.dto.storage.PresignUrlResp;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface StorageService {

    PresignUrlResp generatePresignUrl(String contentType);

    List<PresignUrlResp> batchGeneratePresignUrls(BatchPresignReq req);

    String uploadFile(MultipartFile file);

    /**
     * 异步删除 MinIO 中的对象
     */
    void deleteObjectAsync(String objectKey);
}
