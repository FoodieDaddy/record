package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "MBTI测试提交请求")
public class MbtiTestReq {

    @NotBlank(message = "测试版本不能为空")
    @Schema(description = "测试版本", example = "v1")
    private String testVersion;

    @NotNull(message = "答案列表不能为空")
    @Schema(description = "答案列表(20题)")
    private List<Answer> answers;

    @Data
    @Schema(description = "单题答案")
    public static class Answer {
        @NotBlank(message = "题目ID不能为空")
        @Schema(description = "题目ID", example = "q01")
        private String questionId;

        @NotBlank(message = "维度不能为空")
        @Schema(description = "维度: E_I, S_N, T_F, J_P", example = "E_I")
        private String dimension;

        @Schema(description = "分数: 1=像我, -1=不像我, 0=不确定", example = "1")
        private int score;
    }
}
