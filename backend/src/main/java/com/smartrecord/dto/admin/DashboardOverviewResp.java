package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "Dashboard 总览")
public class DashboardOverviewResp {
    @Schema(description = "总用户数")
    private long totalUsers;
    @Schema(description = "今日活跃用户")
    private long todayActiveUsers;
    @Schema(description = "当前活跃编队")
    private long activeFormations;
    @Schema(description = "今日封存航程")
    private long todaySealed;
    @Schema(description = "今日脉冲流向")
    private long todayTransfers;
    @Schema(description = "今日航段写入")
    private long todayRoundWrites;
}
