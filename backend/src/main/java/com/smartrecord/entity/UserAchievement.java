package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户成就达成与装备关系实体。
 * 记录用户已达成的成就状态（已解锁、已装备等）。
 */
@Data
@TableName("user_achievement")
public class UserAchievement {

    /**
     * 关联的用户 ID
     */
    private Long userId;

    /**
     * 关联的成就配置 ID
     */
    private Long achievementId;

    /**
     * 装备状态：0-已解锁（未装备），1-已装备（装扮生效中）
     */
    private Integer status;

    /**
     * 达成并解锁该成就的时间
     */
    private LocalDateTime unlockedAt;
}
