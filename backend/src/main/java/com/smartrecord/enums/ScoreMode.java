package com.smartrecord.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ScoreMode {

    FREE_FLOW(1, "自由流转"),
    ROUND_RECORD(2, "本局录入");

    private final int code;
    private final String desc;

    public static ScoreMode of(int code) {
        for (ScoreMode m : values()) {
            if (m.code == code) return m;
        }
        return FREE_FLOW;
    }
}
