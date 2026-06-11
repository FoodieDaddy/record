package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 前端关键行为日志实体类
 */
@Data
@TableName("behavior_log")
public class BehaviorLog {

    @TableId(type = IdType.INPUT)
    private Long id;

    /** 用户 ID */
    private Long userId;

    /** 行为类型 */
    private String actionType;

    /** 页面路径 */
    private String pagePath;

    /** 附加负载数据 (JSON) */
    private String payload;

    /** 客户端 IP */
    private String ip;

    /** 客户端 User-Agent */
    private String userAgent;

    /** 创建时间 */
    private LocalDateTime createdAt;
}
