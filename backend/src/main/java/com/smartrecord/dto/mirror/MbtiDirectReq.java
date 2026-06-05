package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "MBTI直接输入请求")
public class MbtiDirectReq {

    @NotBlank(message = "MBTI类型不能为空")
    @Schema(description = "MBTI类型", example = "INTJ")
    private String mbtiType;
}
