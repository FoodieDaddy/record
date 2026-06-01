package com.mahjong.score.dto.storage;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "预签名上传 URL 响应")
public class PresignUrlResp {

    @Schema(description = "预签名 PUT URL（前端直接 PUT 上传）", example = "http://localhost:9000/mahjong-score/xxx?X-Amz-Signature=xxx")
    private String uploadUrl;

    @Schema(description = "文件访问 URL（上传成功后使用）", example = "http://localhost:9000/mahjong-score/session/xxx.jpg")
    private String accessUrl;

    @Schema(description = "文件对象 key", example = "session/2026/06/01/xxx.jpg")
    private String objectKey;
}
