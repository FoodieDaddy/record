package com.mahjong.score.service;

import com.mahjong.score.dto.storage.BatchPresignReq;
import com.mahjong.score.dto.storage.PresignUrlResp;

import java.util.List;

public interface StorageService {

    PresignUrlResp generatePresignUrl(String contentType);

    List<PresignUrlResp> batchGeneratePresignUrls(BatchPresignReq req);
}
