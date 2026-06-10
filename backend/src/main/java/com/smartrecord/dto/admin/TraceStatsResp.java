package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "航迹统计数据")
public class TraceStatsResp {

    @Schema(description = "日期标签")
    private List<String> dates;

    @Schema(description = "封存航程数")
    private List<Long> sealedCounts;

    @Schema(description = "高活跃用户排行")
    private List<UserRankItem> topUsers;

    @Schema(description = "高活跃编队排行")
    private List<FormationRankItem> topFormations;

    @Data
    @Builder
    @Schema(description = "用户排行项")
    public static class UserRankItem {

        @Schema(description = "用户 ID")
        private Long userId;

        @Schema(description = "昵称")
        private String nickname;

        @Schema(description = "封存航程数")
        private Long sealedCount;

        @Schema(description = "总脉冲")
        private Long totalScore;
    }

    @Data
    @Builder
    @Schema(description = "编队排行项")
    public static class FormationRankItem {

        @Schema(description = "房间 ID")
        private Long roomId;

        @Schema(description = "编队码")
        private String roomNo;

        @Schema(description = "成员数")
        private Integer memberCount;

        @Schema(description = "记分模式")
        private Integer scoreMode;
    }
}
