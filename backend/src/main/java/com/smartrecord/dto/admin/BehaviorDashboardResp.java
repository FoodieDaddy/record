package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
@Schema(description = "行为日志与慢请求监控看板数据")
public class BehaviorDashboardResp {

    @Schema(description = "系统异常趋势(近7天)")
    private ErrorTrend errorTrend;

    @Schema(description = "慢接口响应时间排行(前10)")
    private List<SlowRequestRank> slowRequests;

    @Schema(description = "行为类型分布")
    private List<ActionDist> actionDistribution;

    @Data
    @Builder
    @Schema(description = "系统异常趋势数据")
    public static class ErrorTrend {
        @Schema(description = "日期标签列表")
        private List<String> dates; // 日期, 格式如 "MM-dd"
        @Schema(description = "JS 错误总数")
        private List<Long> jsErrors; // JS报错数
        @Schema(description = "网络错误总数")
        private List<Long> networkErrors; // 网络错误数
    }

    @Data
    @Builder
    @Schema(description = "慢请求排行明细")
    public static class SlowRequestRank {
        @Schema(description = "接口路径")
        private String url;
        @Schema(description = "请求方法")
        private String method;
        @Schema(description = "平均响应时长(ms)")
        private Double avgDuration;
        @Schema(description = "发生次数")
        private Integer count;
    }

    @Data
    @Builder
    @Schema(description = "行为分布明细")
    public static class ActionDist {
        @Schema(description = "行为类型")
        private String actionType;
        @Schema(description = "发生次数")
        private Long count;
    }
}
