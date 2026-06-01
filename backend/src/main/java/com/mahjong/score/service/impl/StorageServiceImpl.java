package com.mahjong.score.service.impl;

import com.mahjong.score.config.MinioConfig;
import com.mahjong.score.dto.storage.BatchPresignReq;
import com.mahjong.score.dto.storage.PresignUrlResp;
import com.mahjong.score.service.StorageService;
import com.mahjong.score.util.SnowflakeIdGenerator;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageServiceImpl implements StorageService {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;
    private final SnowflakeIdGenerator idGenerator;

    @Override
    public PresignUrlResp generatePresignUrl(String contentType) {
        String objectKey = buildObjectKey(contentType);
        String accessUrl = minioConfig.getEndpoint() + "/" + minioConfig.getBucket() + "/" + objectKey;

        try {
            String uploadUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(minioConfig.getBucket())
                            .object(objectKey)
                            .expiry(10, TimeUnit.MINUTES)
                            .build());

            return PresignUrlResp.builder()
                    .uploadUrl(uploadUrl)
                    .accessUrl(accessUrl)
                    .objectKey(objectKey)
                    .build();
        } catch (Exception e) {
            log.error("生成预签名 URL 失败", e);
            throw new RuntimeException("生成上传凭证失败");
        }
    }

    @Override
    public List<PresignUrlResp> batchGeneratePresignUrls(BatchPresignReq req) {
        List<PresignUrlResp> results = new ArrayList<>();
        for (String contentType : req.getContentTypes()) {
            results.add(generatePresignUrl(contentType));
        }
        return results;
    }

    private String buildObjectKey(String contentType) {
        LocalDate now = LocalDate.now();
        String ext = contentType.contains("png") ? ".png" : ".jpg";
        return String.format("images/%d/%02d/%02d/%d%s",
                now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
                idGenerator.nextId(), ext);
    }
}
