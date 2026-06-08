package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "常用转出金额推荐")
public class TransferAmountSuggestionResp {

    @Schema(description = "是否使用随机补齐", example = "false")
    private Boolean fallback;

    @Schema(description = "推荐金额列表，最多 6 个")
    private List<Item> items;

    @Data
    @Builder
    @Schema(description = "推荐金额项")
    public static class Item {
        @Schema(description = "金额", example = "10")
        private Integer amount;

        @Schema(description = "来源：crew=个人常发，space=编队高频，random=随机补齐", example = "crew")
        private String source;

        @Schema(description = "展示标签", example = "常发")
        private String label;
    }
}
