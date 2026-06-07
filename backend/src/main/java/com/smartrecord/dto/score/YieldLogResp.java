package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "积分流水终端响应")
public class YieldLogResp {

    @Schema(description = "累计净积分", example = "42")
    private Integer netYield;

    @Schema(description = "采样场次数", example = "8")
    private Integer sampleCount;

    @Schema(description = "曲线解锁所需场次", example = "2")
    private Integer curveUnlockCount;

    @Schema(description = "积分曲线数据点（按时间正序）")
    private List<CurvePoint> curveData;

    @Schema(description = "对局记录列表")
    private List<Record> records;

    @Data
    @Builder
    @Schema(description = "积分曲线数据点")
    public static class CurvePoint {

        @Schema(description = "房间 ID")
        private Long roomId;

        @Schema(description = "对局日期", example = "2026-06-05")
        private String date;

        @Schema(description = "该场净得分", example = "15")
        private Integer netScore;
    }

    @Data
    @Builder
    @Schema(description = "对局记录")
    public static class Record {

        @Schema(description = "房间 ID")
        private Long roomId;

        @Schema(description = "房间编号", example = "A3K7F2")
        private String roomNo;

        @Schema(description = "结算时间", example = "2026-06-05 21:30")
        private String settledAt;

        @Schema(description = "我的得分", example = "12")
        private Integer myScore;

        @Schema(description = "我的排名", example = "3")
        private Integer myRank;

        @Schema(description = "成员数", example = "6")
        private Integer memberCount;
    }
}
