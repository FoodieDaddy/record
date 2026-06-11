package com.smartrecord.service.impl;

import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.alibaba.csp.sentinel.annotation.SentinelResource;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.config.OssConfig;
import com.smartrecord.config.StorageProviderConfig;
import com.smartrecord.dto.storage.PresignUrlResp;
import com.smartrecord.service.StorageService;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
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

    private final OssConfig ossConfig;
    private final SnowflakeIdGenerator idGenerator;
    private final StorageProviderConfig storageProviderConfig;
    private final ObjectProvider<OSS> ossClientProvider;

    @Override
    public String getProvider() {
        return storageProviderConfig.getProvider();
    }

    @Override
    @SentinelResource(value = "oss-presign",
            blockHandler = "presignBlockHandler",
            fallback = "presignFallback")
    public PresignUrlResp generatePresignUrl(String contentType, Long contentLength) {
        String provider = getProvider();

        // cloudbase / cos 模式下，头像由前端直传云存储，presign 仅返回 provider 标识供前端判断
        if ("cloudbase".equals(provider) || "cos".equals(provider)) {
            return PresignUrlResp.builder()
                    .uploadUrl("")
                    .accessUrl("")
                    .objectKey("")
                    .provider(provider)
                    .build();
        }

        // aliyun 模式：生成预签名 URL
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

            OSS client = ossClientProvider.getIfAvailable();
            if (client == null) {
                throw new BizException(503, "OSS 客户端未配置，请在 .env 中配置 OSS 相关变量");
            }
            String uploadUrl = client.generatePresignedUrl(request).toString();
            // 确保使用 HTTPS 协议
            if (uploadUrl.startsWith("http://")) {
                uploadUrl = uploadUrl.replace("http://", "https://");
            }

            return PresignUrlResp.builder()
                    .uploadUrl(uploadUrl)
                    .accessUrl(accessUrl)
                    .objectKey(objectKey)
                    .provider(provider)
                    .build();
        } catch (Exception e) {
            log.error("生成预签名 URL 失败", e);
            throw new RuntimeException("生成上传凭证失败");
        }
    }

    private String buildAccessUrl(String objectKey) {
        return "https://" + ossConfig.getBucketName() + "." + normalizeEndpoint() + "/" + objectKey;
    }

    @Override
    public void deleteObjectAsync(String objectKey) {
        if (objectKey == null || objectKey.isEmpty()) return;
        // cloud:// fileID 由 CloudBase 管理生命周期，不走 OSS 删除
        if (objectKey.startsWith("cloud://")) return;

        CompletableFuture.runAsync(() -> {
            OSS client = ossClientProvider.getIfAvailable();
            if (client == null) return;
            try {
                client.deleteObject(ossConfig.getBucketName(), objectKey);
            } catch (Exception e) {
                log.warn("异步删除存储文件失败: {}", objectKey, e);
            }
        });
    }

    @Override
    public String buildFullUrl(String objectKey) {
        if (objectKey == null || objectKey.isEmpty()) return "";
        // cloud:// fileID 由前端通过 wx.cloud.getTempFileURL 解析，后端直接返回原值
        if (objectKey.startsWith("cloud://")) return objectKey;
        // https:// URL 直接返回（兼容 COS 直链）
        if (objectKey.startsWith("http")) return objectKey;
        return "https://" + ossConfig.getBucketName() + "." + normalizeEndpoint() + "/" + objectKey;
    }

    /**
     * Sentinel 限流降级 — OSS 预签名
     */
    public PresignUrlResp presignBlockHandler(String contentType, Long contentLength, BlockException ex) {
        log.warn("OSS 预签名被限流: {}", ex.getRule());
        throw new BizException(503, "上传服务繁忙，请稍后重试");
    }

    public PresignUrlResp presignFallback(String contentType, Long contentLength, Throwable ex) {
        log.error("OSS 预签名降级", ex);
        throw new BizException(503, "上传服务暂时不可用，请稍后重试");
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
            throw new BizException(ErrorCode.UNSUPPORTED_FILE_TYPE);
        }
        String normalized = contentType.trim().toLowerCase();
        if (!MIME_TO_EXT.containsKey(normalized)) {
            throw new BizException(ErrorCode.UNSUPPORTED_FILE_TYPE);
        }
        return normalized;
    }

    private void validateContentLength(Long contentLength) {
        if (contentLength == null || contentLength <= 0) {
            throw new BizException(ErrorCode.MISSING_FILE_SIZE);
        }
        if (contentLength > MAX_UPLOAD_BYTES) {
            throw new BizException(ErrorCode.FILE_TOO_LARGE);
        }
    }

    private String normalizeEndpoint() {
        return ossConfig.getEndpoint()
                .replace("https://", "")
                .replace("http://", "");
    }
}
