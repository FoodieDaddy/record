package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Schema(description = "管理端编队响应")
public class AdminFormationResp {
    @Schema(example = "123456")
    private Long id;
    @Schema(example = "A1B2C3")
    private String roomNo;
    @Schema(example = "789")
    private Long ownerId;
    @Schema(example = "1")
    private Integer scoreMode;
    @Schema(example = "0")
    private Integer status;
    private LocalDateTime lastActiveAt;
    private LocalDateTime createdAt;

    public static AdminFormationResp from(com.smartrecord.entity.Room room) {
        AdminFormationResp resp = new AdminFormationResp();
        resp.setId(room.getId());
        resp.setRoomNo(room.getRoomNo());
        resp.setOwnerId(room.getOwnerId());
        resp.setScoreMode(room.getScoreMode());
        resp.setStatus(room.getStatus());
        resp.setLastActiveAt(room.getLastActiveAt());
        resp.setCreatedAt(room.getCreatedAt());
        return resp;
    }
}
