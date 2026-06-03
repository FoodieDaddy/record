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

    /** 座位号 1-8 */
    private Integer seatNo;

    private LocalDateTime joinedAt;
}
