package com.smartrecord.service.impl;

import com.smartrecord.dto.mirror.MirrorInterpretation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 内容安全守卫 — 拦截 LLM 输出中的禁止词
 */
@Slf4j
@Component
public class MirrorContentGuard {

    private static final List<String> FORBIDDEN_WORDS = List.of(
            "必胜", "稳赚", "发财", "梭哈", "加注",
            "借钱", "贷款", "翻本", "改命", "化灾",
            "血光", "死亡"
    );

    /**
     * 检查解释结果是否安全
     */
    public boolean isSafe(MirrorInterpretation interp) {
        if (interp == null) return true;

        String text = joinText(interp);
        for (String word : FORBIDDEN_WORDS) {
            if (text.contains(word)) {
                log.warn("ContentGuard 拦截禁止词: {}", word);
                return false;
            }
        }
        return true;
    }

    /**
     * 如果不安全，替换为 fallback
     */
    public MirrorInterpretation sanitize(MirrorInterpretation interp, MirrorInterpretation fallback) {
        if (isSafe(interp)) {
            return interp;
        }
        log.warn("ContentGuard 触发，使用 fallback 解释");
        return fallback;
    }

    private String joinText(MirrorInterpretation interp) {
        StringBuilder sb = new StringBuilder();
        if (interp.getTitle() != null) sb.append(interp.getTitle());
        if (interp.getTag() != null) sb.append(interp.getTag());
        if (interp.getSummary() != null) sb.append(interp.getSummary());
        if (interp.getSuggestions() != null) interp.getSuggestions().forEach(sb::append);
        if (interp.getWarnings() != null) interp.getWarnings().forEach(sb::append);
        return sb.toString();
    }
}
