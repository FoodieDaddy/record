package com.smartrecord.service.impl;

import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.smartrecord.common.BizException;
import com.smartrecord.config.OssConfig;
import com.smartrecord.dto.storage.PresignUrlResp;
import com.smartrecord.service.StorageService;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageServiceImpl implements StorageService {

    private static final long MAX_UPLOAD_BYTES = 2L * 1024 * 1024;
    private static final String OBJECT_PREFIX = "avatars/";

    private final OSS ossClient;
    private final OssConfig ossConfig;
    private final SnowflakeIdGenerator idGenerator;

    @Override
    public PresignUrlResp generatePresignUrl(String contentType, Long contentLength) {
        String normalizedContentType = normalizeContentType(contentType);
        validateContentLength(contentLength);
        String objectKey = buildObjectKey(normalizedContentType);
        String accessUrl = buildAccessUrl(objectKey);

        try {
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                    ossConfig.getBucketName(), objectKey, HttpMethod.PUT);
            // 10 分钟有效期
            request.setExpiration(new Date(System.currentTimeMillis() + 10 * 60 * 1000));
            // 约束 Content-Type，防止前端传错
            request.setContentType(normalizedContentType);
            request.addHeader("Content-Length", String.valueOf(contentLength));

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

    private String buildAccessUrl(String objectKey) {
        // 前端直传使用 uploadUrl，后续存储到数据库用 objectUrl
        String objectUrl = "https://" + ossConfig.getBucketName() + "." + normalizeEndpoint() + "/" + objectKey;
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
        return "https://" + ossConfig.getBucketName() + "." + normalizeEndpoint() + "/" + objectKey;
    }

    private static final Map<String, String> MIME_TO_EXT = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp"
    );

    private String buildObjectKey(String contentType) {
        String ext = MIME_TO_EXT.get(contentType);
        return OBJECT_PREFIX + idGenerator.nextId() + ext;
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) {
            throw new BizException(400, "不支持的文件类型");
        }
        String normalized = contentType.trim().toLowerCase();
        if (!MIME_TO_EXT.containsKey(normalized)) {
            throw new BizException(400, "不支持的文件类型");
        }
        return normalized;
    }

    private void validateContentLength(Long contentLength) {
        if (contentLength == null || contentLength <= 0) {
            throw new BizException(400, "缺少文件大小");
        }
        if (contentLength > MAX_UPLOAD_BYTES) {
            throw new BizException(400, "文件不能超过 2MB");
        }
    }

    private String normalizeEndpoint() {
        return ossConfig.getEndpoint()
                .replace("https://", "")
                .replace("http://", "");
    }
}
