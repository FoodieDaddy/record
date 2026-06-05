package com.smartrecord.dto.fortune;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "每日策略响应")
public class FortuneResp {

    @Schema(description = "策略提示", example = "今日状态平稳，先稳住节奏")
    private String verdict;

    @Schema(description = "系统增益 (Buff) 列表", example = "[\"连胜势能加持\", \"心态稳定\"]")
    private List<String> buffs;

    @Schema(description = "风险警告 (Debuff) 列表", example = "[\"注意冲动计分\"]")
    private List<String> debuffs;

    @Schema(description = "光球颜色 (HEX)", example = "#0A84FF")
    private String glowColor;

    @Schema(description = "精简状态标签 (2-4字)", example = "稳健")
    private String tag;

    @Schema(description = "用户画像标签", example = "WINNING_STREAK")
    private String userTag;

    @Schema(description = "数据来源：llm=大模型, fallback=本地兜底", example = "llm")
    private String source;

    @Schema(description = "农历日期（干支年+农历月日）", example = "丙午年四月十九")
    private String lunarDate;

    @Schema(description = "当前节气", example = "芒种")
    private String solarTerm;

    @Schema(description = "卡牌中文名", example = "压制者")
    private String title;

    @Schema(description = "卡牌英文名", example = "THE DOMINATOR")
    private String subtitle;

    @Schema(description = "策略标签列表", example = "[\"强势\", \"连续\", \"压制\"]")
    private List<String> tags;

    @Schema(description = "下次可刷新时间 (HH:mm:ss)，null 表示今日已生成", example = "20:30:43")
    private String nextRefreshAt;
}
