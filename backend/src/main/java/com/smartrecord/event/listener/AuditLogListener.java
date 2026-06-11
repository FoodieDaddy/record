package com.smartrecord.event.listener;

import com.smartrecord.entity.Admin;
import com.smartrecord.entity.AuditLog;
import com.smartrecord.event.SecurityActionEvent;
import com.smartrecord.mapper.AdminMapper;
import com.smartrecord.mapper.AuditLogMapper;
import com.smartrecord.util.IPLocationUtil;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 敏感操作审计日志事件监听器，使用虚拟线程池异步处理
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogListener {

    private final AuditLogMapper auditLogMapper;
    private final AdminMapper adminMapper;
    private final SnowflakeIdGenerator idGenerator;

    @Async("asyncExecutor")
    @EventListener
    public void onSecurityActionEvent(SecurityActionEvent event) {
        log.info("接收到敏感操作审计事件: action={}, targetType={}, targetId={}, IP={}", 
                event.getActionType(), event.getTargetType(), event.getTargetId(), event.getIp());
        try {
            // 异步查询管理员的真实姓名
            String adminName = "系统管理员";
            if (event.getAdminId() != null) {
                Admin admin = adminMapper.selectById(event.getAdminId());
                if (admin != null) {
                    adminName = admin.getUsername();
                }
            }

            // 地理位置解析
            String location = IPLocationUtil.parseLocation(event.getIp());
            String finalResult = event.getResult();
            if (location != null && !location.isEmpty()) {
                finalResult = event.getResult() + " (" + location + ")";
            }

            AuditLog logEntity = new AuditLog();
            logEntity.setId(idGenerator.nextId());
            logEntity.setAdminId(event.getAdminId());
            logEntity.setAdminName(adminName);
            logEntity.setActionType(event.getActionType());
            logEntity.setTargetType(event.getTargetType());
            logEntity.setTargetId(event.getTargetId());
            logEntity.setIp(event.getIp());
            logEntity.setResult(finalResult);
            logEntity.setCreatedAt(LocalDateTime.now());

            auditLogMapper.insert(logEntity);
            log.info("敏感操作审计日志记录成功, ID: {}", logEntity.getId());
        } catch (Exception e) {
            log.error("敏感操作审计日志异步落库失败", e);
        }
    }
}
