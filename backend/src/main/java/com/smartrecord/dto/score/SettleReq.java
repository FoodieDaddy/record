package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * 结束对局请求
 */
@Data
@Schema(description = "结束对局请求")
public class SettleReq {

    @Schema(description = "客户端请求 ID，用于幂等去重", example = "1718000000000-a3f8b2")
    private String clientRequestId;
}
