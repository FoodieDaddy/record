package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 成就定义配置实体。
 * 用于定义系统内支持的各类成就，及其解锁后获得的个性化装扮皮肤奖励。
 */
@Data
@TableName("achievement")
public class Achievement {

    /**
     * 雪花算法 ID 或内置 ID
     */
    @TableId(type = IdType.INPUT)
    private Long id;

    /**
     * 成就名称，例如：“逆熵翻盘者”
     */
    private String name;

    /**
     * 达成条件说明，展示给玩家查看
     */
    private String description;

    /**
     * 解锁的个性化装扮类型。
     * 0-无，1-特殊标识(badge，显示在昵称旁)，2-头像框皮肤(border)，3-特殊语音(voice)，4-粒子特效(beam)
     */
    private Integer cosmeticType;

    /**
     * 装扮参数配置 JSON/资源路径。
     * 例如：{"badge":"逆熵"} 或 {"avatarBorder":"apex-pilot-border"}
     */
    private String cosmeticPayload;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
}
