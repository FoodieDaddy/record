package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "记分提交响应")
public class ScoreSubmitResp {

    @Schema(description = "提交者的情绪音频 URL（null 表示无分数变动）", example = "https://bucket.oss-cn-hangzhou.aliyuncs.com/emotion/positive_01.mp3")
    private String emotionAudioUrl;
}
