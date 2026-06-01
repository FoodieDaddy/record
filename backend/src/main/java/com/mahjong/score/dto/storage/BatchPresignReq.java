package com.mahjong.score.dto.storage;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "批量获取预签名 URL 请求")
public class BatchPresignReq {

    @Min(value = 1, message = "至少 1 个文件")
    @Max(value = 9, message = "最多 9 个文件")
    @Schema(description = "文件数量", example = "3")
    private int count;

    @Schema(description = "文件 Content-Type 列表", example = "[\"image/jpeg\", \"image/jpeg\", \"image/png\"]")
    private List<String> contentTypes;
}
