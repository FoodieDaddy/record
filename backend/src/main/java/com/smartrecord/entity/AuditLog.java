package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 管理员操作审计日志
 */
@Data
@TableName("audit_log")
public class AuditLog {

    @TableId(type = IdType.INPUT)
    private Long id;

    /** 操作管理员 ID */
    private Long adminId;

    /** 操作管理员用户名 */
    private String adminName;

    /** 操作类型：CREATE / UPDATE / DELETE / LOGIN 等 */
    private String actionType;

    /** 操作目标类型：ADMIN / USER / ROOM 等 */
    private String targetType;

    /** 操作目标 ID */
    private String targetId;

    /** 请求来源 IP */
    private String ip;

    /** 操作结果 */
    private String result;

    private LocalDateTime createdAt;
}
