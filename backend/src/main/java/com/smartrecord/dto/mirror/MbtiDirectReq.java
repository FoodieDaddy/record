package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "MBTI直接输入请求")
public class MbtiDirectReq {

    @NotNull(message = "MBTI类型编号不能为空")
    @Min(value = 1, message = "MBTI类型编号最小为1")
    @Max(value = 16, message = "MBTI类型编号最大为16")
    @Schema(description = "MBTI类型编号 1-16", example = "1")
    private Integer mbtiCode;
}
