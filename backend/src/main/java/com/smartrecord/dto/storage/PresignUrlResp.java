package com.smartrecord.dto.storage;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "预签名上传 URL 响应")
public class PresignUrlResp {

    @Schema(description = "预签名 PUT URL（前端直接 PUT 上传）", example = "https://bucket.oss-cn-hangzhou.aliyuncs.com/images/2026/06/03/123.jpg?Expires=xxx&OSSAccessKeyId=xxx&Signature=xxx")
    private String uploadUrl;

    @Schema(description = "文件访问 URL（上传成功后使用）", example = "https://bucket.oss-cn-hangzhou.aliyuncs.com/images/2026/06/03/123.jpg")
    private String accessUrl;

    @Schema(description = "文件对象 key", example = "session/2026/06/01/xxx.jpg")
    private String objectKey;

    @Schema(description = "存储提供者标识", example = "aliyun")
    private String provider;
}
