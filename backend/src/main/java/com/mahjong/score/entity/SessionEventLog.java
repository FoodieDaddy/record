package com.mahjong.score.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "session_event_log", autoResultMap = true)
public class SessionEventLog {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long sessionId;

    /** 该局所有批次的结构化流水 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<BatchEvent> eventsData;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @Data
    public static class BatchEvent {
        /** 批次时间戳（毫秒） */
        private Long batchTime;
        /** 发起记分人 ID */
        private Long createdBy;
        /** 各玩家得分 */
        private List<PlayerScore> scores;
    }

    @Data
    public static class PlayerScore {
        private Long userId;
        private Integer score;
    }
}
