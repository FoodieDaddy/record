package com.smartrecord.enums;

import java.util.Optional;

/**
 * MBTI 16型枚举，编号 1-16，0 表示未设置
 */
public enum MbtiType {

    UNSET(0, null),
    INTJ(1, "INTJ"),
    INTP(2, "INTP"),
    ENTJ(3, "ENTJ"),
    ENTP(4, "ENTP"),
    INFJ(5, "INFJ"),
    INFP(6, "INFP"),
    ENFJ(7, "ENFJ"),
    ENFP(8, "ENFP"),
    ISTJ(9, "ISTJ"),
    ISFJ(10, "ISFJ"),
    ESTJ(11, "ESTJ"),
    ESFJ(12, "ESFJ"),
    ISTP(13, "ISTP"),
    ISFP(14, "ISFP"),
    ESTP(15, "ESTP"),
    ESFP(16, "ESFP");

    private final int code;
    private final String type;

    MbtiType(int code, String type) {
        this.code = code;
        this.type = type;
    }

    public int getCode() {
        return code;
    }

    public String getType() {
        return type;
    }

    public static Optional<MbtiType> fromCode(int code) {
        for (MbtiType v : values()) {
            if (v.code == code) return Optional.of(v);
        }
        return Optional.empty();
    }

    public static Optional<MbtiType> fromType(String type) {
        if (type == null) return Optional.empty();
        String upper = type.toUpperCase();
        for (MbtiType v : values()) {
            if (upper.equals(v.type)) return Optional.of(v);
        }
        return Optional.empty();
    }

    public static boolean isValidCode(int code) {
        return fromCode(code).map(v -> v != UNSET).orElse(false);
    }
}
