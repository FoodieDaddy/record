package com.mahjong.score.task;

import com.mahjong.score.mapper.SessionEventLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 定时清理过期的 session_event_log 记录
 * 流水明细数据仅具短期对账价值，90 天后自动清理
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventLogCleanupTask {

    private final SessionEventLogMapper sessionEventLogMapper;

    private static final int BATCH_SIZE = 1000;

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanup() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(90);
        log.info("开始清理 {} 之前的 session_event_log 记录", cutoff);

        int totalDeleted = 0;
        while (true) {
            int affected = sessionEventLogMapper.batchDeleteExpired(cutoff, BATCH_SIZE);
            totalDeleted += affected;
            if (affected < BATCH_SIZE) {
                break;
            }
        }

        log.info("清理完成，共删除 {} 条 session_event_log 记录", totalDeleted);
    }
}
