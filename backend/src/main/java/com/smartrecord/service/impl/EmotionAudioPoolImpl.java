package com.smartrecord.service.impl;

import com.smartrecord.common.EmotionType;
import com.smartrecord.service.EmotionAudioPool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Component
public class EmotionAudioPoolImpl implements EmotionAudioPool {

    @Value("${emotion.audio.win-urls:}")
    private List<String> winUrls;

    @Value("${emotion.audio.lose-urls:}")
    private List<String> loseUrls;

    @Value("${emotion.audio.neutral-urls:}")
    private List<String> neutralUrls;

    @PostConstruct
    public void init() {
        winUrls = winUrls == null ? Collections.emptyList() : winUrls;
        loseUrls = loseUrls == null ? Collections.emptyList() : loseUrls;
        neutralUrls = neutralUrls == null ? Collections.emptyList() : neutralUrls;
        log.info("情绪音频池加载完成: positive={}, negative={}, neutral={}", winUrls.size(), loseUrls.size(), neutralUrls.size());
    }

    @Override
    public String randomUrl(EmotionType type) {
        List<String> pool;
        if (type == EmotionType.NEUTRAL) {
            pool = neutralUrls;
        } else if (type == EmotionType.WIN) {
            pool = winUrls;
        } else {
            pool = loseUrls;
        }
        if (pool.isEmpty()) return null;
        return pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
    }
}
