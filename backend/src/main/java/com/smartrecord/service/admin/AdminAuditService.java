package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.entity.AuditLog;
import com.smartrecord.mapper.AuditLogMapper;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 审计日志服务
 */
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    private final AuditLogMapper auditLogMapper;
    private final SnowflakeIdGenerator idGenerator;

    /**
     * 审计日志列表（分页，按时间倒序）
     */
    public Page<AuditLog> listLogs(int page, int size) {
        return auditLogMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AuditLog>().orderByDesc(AuditLog::getCreatedAt));
    }

    /**
     * 记录一条审计日志
     */
    public void record(Long adminId, String adminName, String action,
                       String targetType, String targetId, String ip) {
        AuditLog log = new AuditLog();
        log.setId(idGenerator.nextId());
        log.setAdminId(adminId);
        log.setAdminName(adminName);
        log.setActionType(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setIp(ip);
        log.setResult("成功");
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);
    }
}
