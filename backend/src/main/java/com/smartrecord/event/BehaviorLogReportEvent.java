package com.smartrecord.event;

import com.smartrecord.dto.behavior.BehaviorReportReq;
import org.springframework.context.ApplicationEvent;

import java.util.List;

/**
 * 行为日志上报事件
 */
public class BehaviorLogReportEvent extends ApplicationEvent {

    private final Long userId;
    private final String ip;
    private final String userAgent;
    private final List<BehaviorReportReq> reports;

    public BehaviorLogReportEvent(Object source, Long userId, String ip, String userAgent, List<BehaviorReportReq> reports) {
        super(source);
        this.userId = userId;
        this.ip = ip;
        this.userAgent = userAgent;
        this.reports = reports;
    }

    public Long getUserId() {
        return userId;
    }

    public String getIp() {
        return ip;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public List<BehaviorReportReq> getReports() {
        return reports;
    }
}
