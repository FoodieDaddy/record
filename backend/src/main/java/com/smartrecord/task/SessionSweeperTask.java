package com.smartrecord.task;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.entity.Session;
import com.smartrecord.mapper.SessionMapper;
import com.smartrecord.service.ScoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 幽灵对局兜底结算：清理超过 12 小时无活动的进行中场次
 * <p>
 * 场景：用户打完牌忘记点击"结束"，导致 Redis 内存不释放、数据未归档。
 * 每小时扫描一次，强制结算超时场次并释放 Redis 资源。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SessionSweeperTask {

    private static final String SESSION_PREFIX = "sr:session:";
    /** 最大不活跃时长（小时） */
    private static final int MAX_IDLE_HOURS = 12;

    private final SessionMapper sessionMapper;
    private final ScoreService scoreService;
    private final StringRedisTemplate redisTemplate;

    /**
     * 每小时整点执行，扫描并强制结算超时场次
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void sweep() {
        log.info("[Sweeper] 开始扫描超时场次...");
        int swept = 0;

        List<Session> activeSessions = sessionMapper.selectList(
                new LambdaQueryWrapper<Session>().eq(Session::getStatus, 0));

        for (Session session : activeSessions) {
            try {
                // 优先从 Redis 读取最后活跃时间，未命中则用 MySQL 更新时间
                String lastActiveStr = redisTemplate.opsForValue()
                        .get(SESSION_PREFIX + session.getId() + ":last_active");
                LocalDateTime lastActive;
                if (lastActiveStr != null) {
                    lastActive = LocalDateTime.parse(lastActiveStr);
                } else if (session.getCreatedAt() != null) {
                    lastActive = session.getCreatedAt();
                } else {
                    continue;
                }

                if (lastActive.plusHours(MAX_IDLE_HOURS).isBefore(LocalDateTime.now())) {
                    log.info("[Sweeper] 强制结算超时场次: sessionId={}, roomId={}, 最后活跃={}",
                            session.getId(), session.getRoomId(), lastActive);
                    scoreService.forceSettleSession(session.getId());
                    swept++;
                }
            } catch (Exception e) {
                log.error("[Sweeper] 结算场次 {} 失败", session.getId(), e);
            }
        }

        log.info("[Sweeper] 扫描完成，本轮强制结算 {} 个场次", swept);
    }
}
