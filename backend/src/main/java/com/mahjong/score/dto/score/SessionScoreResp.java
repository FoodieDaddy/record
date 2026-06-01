package com.mahjong.score.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
@Schema(description = "场次完整记分流水响应")
public class SessionScoreResp {

    @Schema(description = "场次 ID", example = "1750000000000020")
    private Long sessionId;

    @Schema(description = "场次状态：0-进行中 1-已结算", example = "0")
    private Integer status;

    @Schema(description = "各玩家累计总分（userId -> totalScore）")
    private Map<Long, Integer> playerTotals;

    @Schema(description = "按批次分组的记分流水（时间倒序）")
    private List<ScoreBatchResp> batches;
}
