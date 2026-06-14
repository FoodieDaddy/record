package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "转分金额推荐响应")
public class TransferAmountSuggestionResp implements Serializable {

    private static final long serialVersionUID = 1L;

    @Schema(description = "推荐金额列表")
    private List<SuggestionItem> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "单个推荐金额")
    public static class SuggestionItem implements Serializable {

        private static final long serialVersionUID = 1L;

        @Schema(description = "推荐金额", example = "10")
        private int amount;

        @Schema(description = "标签", example = "常用")
        private String label;

        @Schema(description = "来源: crew(常用)/space(编队推荐)", example = "crew")
        private String source;
    }
}
