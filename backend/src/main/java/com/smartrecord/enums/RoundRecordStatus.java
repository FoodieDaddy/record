package com.smartrecord.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum RoundRecordStatus {

    PENDING_MEMBER_INPUT(1, "等待成员填写"),
    PENDING_CONFIRM(2, "等待全员确认"),
    APPLIED(3, "已生效"),
    REJECTED(4, "已驳回"),
    CANCELLED(5, "已取消");

    private final int code;
    private final String desc;

    public static RoundRecordStatus of(int code) {
        for (RoundRecordStatus s : values()) {
            if (s.code == code) return s;
        }
        return CANCELLED;
    }
}
