package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "趋势数据")
public class TrendDataResp {

    @Schema(description = "日期标签")
    private List<String> dates;

    @Schema(description = "用户增长")
    private List<Long> userGrowth;

    @Schema(description = "编队创建")
    private List<Long> formationCreated;
}
