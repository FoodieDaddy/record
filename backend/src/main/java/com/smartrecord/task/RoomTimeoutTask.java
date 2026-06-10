package com.smartrecord.task;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.entity.Room;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.service.RoomService;
import com.smartrecord.service.ScoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomTimeoutTask {

    private static final int TIMEOUT_HOURS = 3;
    private static final long DELAY_MS = 500;
    private static final String ROOM_PREFIX = "sr:room:";

    private final RoomMapper roomMapper;
    private final ScoreService scoreService;
    private final RoomService roomService;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;

    @Scheduled(fixedDelay = 300_000) // 上一轮结束后等 5 分钟再触发
    public void autoSettleInactive() {
        RLock taskLock = redissonClient.getLock("sr:task:room_timeout");
        try {
            if (!taskLock.tryLock(0, 300, TimeUnit.SECONDS)) {
                log.debug("RoomTimeoutTask 已有实例在运行，跳过");
                return;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }

        try {
            LocalDateTime threshold = LocalDateTime.now().minusHours(TIMEOUT_HOURS);
            List<Room> rooms = roomMapper.selectList(
                    new LambdaQueryWrapper<Room>()
                            .eq(Room::getStatus, 0)
                            .and(w -> w.isNull(Room::getLastActiveAt)
                                    .or().lt(Room::getLastActiveAt, threshold))
                            .orderByAsc(Room::getLastActiveAt));

            if (rooms.isEmpty()) return;

            log.info("RoomTimeoutTask: 本轮处理 {} 个超时房间", rooms.size());

            for (int i = 0; i < rooms.size(); i++) {
                Room room = rooms.get(i);
                try {
                    Long roomId = room.getId();
                    String eventsKey = ROOM_PREFIX + roomId + ":events";

                    Long eventCount = redisTemplate.opsForZSet().zCard(eventsKey);
                    boolean hasEvents = eventCount != null && eventCount > 0;

                    if (hasEvents) {
                        log.info("房间 {} 超时 {} 小时，自动结算（events={}）", roomId, TIMEOUT_HOURS, eventCount);
                        scoreService.settleRoom(room.getOwnerId(), roomId, true);
                    } else {
                        log.info("房间 {} 超时 {} 小时且无积分数据，自动解散", roomId, TIMEOUT_HOURS);
                        roomService.dissolveRoom(room.getOwnerId(), roomId);
                    }
                } catch (Exception e) {
                    log.error("自动处理超时房间 {} 失败", room.getId(), e);
                }

                // 房间间延迟，避免突发写入打满连接池
                if (i < rooms.size() - 1) {
                    try {
                        Thread.sleep(DELAY_MS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        } finally {
            if (taskLock.isHeldByCurrentThread()) {
                taskLock.unlock();
            }
        }
    }
}
