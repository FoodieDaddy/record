package com.smartrecord.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum RoundInputMethod {

    HOST_FILL(1, "房主填写"),
    MEMBER_FILL(2, "成员自填");

    private final int code;
    private final String desc;

    public static RoundInputMethod of(int code) {
        for (RoundInputMethod m : values()) {
            if (m.code == code) return m;
        }
        return HOST_FILL;
    }
}
