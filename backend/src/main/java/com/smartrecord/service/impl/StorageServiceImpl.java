package com.smartrecord.service.impl;

import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.smartrecord.config.OssConfig;
import com.smartrecord.dto.storage.BatchPresignReq;
import com.smartrecord.dto.storage.PresignUrlResp;
import com.smartrecord.service.StorageService;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageServiceImpl implements StorageService {

    private final OSS ossClient;
    private final OssConfig ossConfig;
    private final SnowflakeIdGenerator idGenerator;

    @Override
    public PresignUrlResp generatePresignUrl(String contentType) {
        String objectKey = buildObjectKey(contentType);
        String accessUrl = buildAccessUrl(objectKey);

        try {
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                    ossConfig.getBucketName(), objectKey, HttpMethod.PUT);
            // 10 分钟有效期
            request.setExpiration(new Date(System.currentTimeMillis() + 10 * 60 * 1000));
            // 约束 Content-Type，防止前端传错
            request.setContentType(contentType);

            String uploadUrl = ossClient.generatePresignedUrl(request).toString();
            // 确保使用 HTTPS 协议
            if (uploadUrl.startsWith("http://")) {
                uploadUrl = uploadUrl.replace("http://", "https://");
            }

            return PresignUrlResp.builder()
                    .uploadUrl(uploadUrl)
                    .accessUrl(accessUrl)
                    .objectKey(objectKey)
                    .build();
        } catch (Exception e) {
            log.error("生成 OSS 预签名 URL 失败", e);
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



    private String buildAccessUrl(String objectKey) {
        // 前端直传使用 uploadUrl，后续存储到数据库用 objectUrl
        String objectUrl = "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint().replace("https://", "") + "/" + objectKey;
        return objectUrl;
    }

    @Override
    public void deleteObjectAsync(String objectKey) {
        CompletableFuture.runAsync(() -> {
            try {
                ossClient.deleteObject(ossConfig.getBucketName(), objectKey);
            } catch (Exception e) {
                log.warn("异步删除 OSS 文件失败: {}", objectKey, e);
            }
        });
    }

    @Override
    public String buildFullUrl(String objectKey) {
        if (objectKey == null || objectKey.isEmpty()) return "";
        if (objectKey.startsWith("http")) return objectKey;
        return "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/" + objectKey;
    }

    private static final Map<String, String> MIME_TO_EXT = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp"
    );

    private String buildObjectKey(String contentType) {
        String ext = MIME_TO_EXT.getOrDefault(contentType.toLowerCase(), ".jpg");
        return "images/" + idGenerator.nextId() + ext;
    }
}
