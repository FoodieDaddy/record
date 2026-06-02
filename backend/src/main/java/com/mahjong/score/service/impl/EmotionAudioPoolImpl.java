package com.mahjong.score.service.impl;

import com.mahjong.score.common.EmotionType;
import com.mahjong.score.service.EmotionAudioPool;
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

    @PostConstruct
    public void init() {
        winUrls = winUrls == null ? Collections.emptyList() : winUrls;
        loseUrls = loseUrls == null ? Collections.emptyList() : loseUrls;
        log.info("情绪音频池加载完成: win={}, lose={}", winUrls.size(), loseUrls.size());
    }

    @Override
    public String randomUrl(EmotionType type) {
        List<String> pool = (type == EmotionType.WIN) ? winUrls : loseUrls;
        if (pool.isEmpty()) return null;
        return pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
    }
}
