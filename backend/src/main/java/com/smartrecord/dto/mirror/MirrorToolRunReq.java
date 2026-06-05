package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
@Schema(description = "镜像工具运行请求")
public class MirrorToolRunReq {

    @NotBlank(message = "工具类型不能为空")
    @Schema(description = "工具类型code", example = "meihua")
    private String tool;

    @Schema(description = "用户问题", example = "今晚适合主动进攻吗")
    private String question;

    @Schema(description = "工具参数")
    private Map<String, Object> params;
}
