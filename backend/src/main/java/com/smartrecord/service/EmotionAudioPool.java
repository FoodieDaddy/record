package com.smartrecord.service;

import com.smartrecord.enums.EmotionType;

/**
 * 情绪音频池 — 按情绪类型随机获取预置音频 URL
 */
public interface EmotionAudioPool {

    /**
     * 随机获取一条指定情绪类型的音频 URL
     * @param type 情绪类型
     * @return 音频 URL，若该类型无可用音频则返回 null
     */
    String randomUrl(EmotionType type);
}
