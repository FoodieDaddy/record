package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("room_member")
public class RoomMember {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long roomId;

    private Long userId;

    /** 座位号 1-16 */
    private Integer seatNo;

    private LocalDateTime joinedAt;

    /** 退出/结算时间 */
    private LocalDateTime quitTime;

    /** 该用户本局最终净胜分 */
    private Integer finalScore;
}
