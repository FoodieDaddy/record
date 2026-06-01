package com.mahjong.score.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@Schema(description = "场次详情响应")
public class SessionResp {

    @Schema(description = "场次 ID", example = "1750000000000020")
    private Long sessionId;

    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @Schema(description = "场次序号", example = "1")
    private Integer sessionNo;

    @Schema(description = "场次标题", example = "下午场")
    private String title;

    @Schema(description = "状态：0-进行中 1-已结算", example = "0")
    private Integer status;

    @Schema(description = "记分笔数", example = "12")
    private Integer scoreCount;

    @Schema(description = "各玩家累计总分（userId -> totalScore）")
    private Map<Long, Integer> playerTotals;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "结算时间")
    private LocalDateTime settledAt;
}
