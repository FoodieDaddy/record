package com.mahjong.score.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
@Schema(description = "更新座位布局请求")
public class UpdateLayoutReq {

    @NotBlank(message = "布局类型不能为空")
    @Pattern(regexp = "circle|rectangle|arc", message = "布局类型仅支持 circle, rectangle, arc")
    @Schema(description = "布局类型: circle=圆桌, rectangle=长桌, arc=半弧", example = "circle")
    private String layoutType;
}
