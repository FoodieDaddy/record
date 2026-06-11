package com.smartrecord.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ErrorCodeTest {

    @Test
    @DisplayName("所有错误码 code 值唯一（排除 SYSTEM_BUSY 和 INTERNAL_ERROR）")
    void allCodesShouldBeUnique() {
        Map<Integer, List<String>> codeToNames = new HashMap<>();
        for (ErrorCode code : ErrorCode.values()) {
            codeToNames.computeIfAbsent(code.getCode(), k -> new ArrayList<>()).add(code.name());
        }

        // 允许 500 有两个（SYSTEM_BUSY 和 INTERNAL_ERROR）
        List<String> duplicates = new ArrayList<>();
        for (var entry : codeToNames.entrySet()) {
            int codeValue = entry.getKey();
            List<String> names = entry.getValue();
            if (codeValue == 500 && names.size() <= 2) continue; // SYSTEM_BUSY + INTERNAL_ERROR
            if (names.size() > 1) {
                duplicates.add("code=" + codeValue + ": " + String.join(", ", names));
            }
        }

        assertTrue(duplicates.isEmpty(),
                "发现重复的错误码: " + String.join("; ", duplicates));
    }

    @Test
    @DisplayName("所有错误码 message 非空")
    void allMessagesShouldBeNonEmpty() {
        for (ErrorCode code : ErrorCode.values()) {
            assertNotNull(code.getMessage(), code.name() + " 的 message 不应为 null");
            assertFalse(code.getMessage().isBlank(), code.name() + " 的 message 不应为空");
        }
    }
}
