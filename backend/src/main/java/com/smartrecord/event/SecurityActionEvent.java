package com.smartrecord.event;

import org.springframework.context.ApplicationEvent;

/**
 * 敏感操作审计日志事件
 */
public class SecurityActionEvent extends ApplicationEvent {

    private final Long adminId;
    private final String actionType;
    private final String targetType;
    private final String targetId;
    private final String ip;
    private final String result;

    public SecurityActionEvent(Object source, Long adminId, String actionType, 
                               String targetType, String targetId, String ip, String result) {
        super(source);
        this.adminId = adminId;
        this.actionType = actionType;
        this.targetType = targetType;
        this.targetId = targetId;
        this.ip = ip;
        this.result = result;
    }

    public Long getAdminId() {
        return adminId;
    }

    public String getActionType() {
        return actionType;
    }

    public String getTargetType() {
        return targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public String getIp() {
        return ip;
    }

    public String getResult() {
        return result;
    }
}
