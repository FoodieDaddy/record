package com.smartrecord.event.listener;

import com.smartrecord.entity.Room;
import com.smartrecord.entity.User;
import com.smartrecord.event.RoomSettledEvent;
import com.smartrecord.service.AchievementService;
import com.smartrecord.service.IdentityLevelService;
import com.smartrecord.service.MirrorProfileService;
import com.smartrecord.service.MirrorStatsService;
import com.smartrecord.service.SubscribeMessageService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import com.smartrecord.event.MirrorPersonaRebuildEvent;
import com.alicp.jetcache.Cache;
import com.alicp.jetcache.anno.CreateCache;
import com.alicp.jetcache.anno.CacheType;
import com.smartrecord.dto.fortune.FortuneResp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 房间结算事件监听器。
 * 负责接收结算事件，在虚拟线程池中并行、异步地处理等级重算、成就发放、微信订阅推送以及缓存刷新，降低结算核心流程的耦合度。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomSettledListener {

    private final IdentityLevelService identityLevelService;
    private final AchievementService achievementService;
    private final MirrorProfileService mirrorProfileService;
    private final MirrorStatsService mirrorStatsService;
    private final SubscribeMessageService subscribeMessageService;
    private final ScoreWebSocket scoreWebSocket;
    private final UserMapper userMapper;
    private final ApplicationEventPublisher eventPublisher;

    @CreateCache(name = "sr:fortune:", cacheType = CacheType.BOTH, expire = 14400)
    @SuppressWarnings("deprecation")
    private Cache<String, FortuneResp> fortuneCache;

    @Async("asyncExecutor")
    @EventListener
    public void handleRoomSettled(RoomSettledEvent event) {
        Room room = event.getRoom();
        Long roomId = room.getId();
        Map<Long, Integer> playerTotalMap = event.getPlayerTotalMap();
        List<Map<String, Object>> allRecord = event.getAllRecord();

        log.info("监听到房间结算事件，开始执行异步后续业务: roomId={}, 涉及用户数={}", roomId, playerTotalMap.size());

        String today = LocalDate.now().toString();

        for (Long uid : playerTotalMap.keySet()) {
            // 1. 异步重算身份等级
            try {
                identityLevelService.recalculate(uid);
            } catch (Exception e) {
                log.warn("事件监听器处理身份等级重算失败: userId={}", uid, e);
            }

            // 2. 异步扫描并判定该用户本场达成的成就奖励
            try {
                achievementService.scanAndAward(uid, roomId, allRecord, playerTotalMap);
            } catch (Exception e) {
                log.warn("事件监听器重算成就奖励失败: userId={}", uid, e);
            }

            // 3. 清理镜像缓存，下次访问重新计算
            try {
                mirrorProfileService.clearProfileCache(uid);
                mirrorStatsService.clearStatsCache(uid);
            } catch (Exception e) {
                log.warn("事件监听器清理镜像缓存失败: userId={}", uid, e);
            }

            // 4. 清理今日策略缓存，下次访问使用新样本
            try {
                fortuneCache.remove(uid + ":" + today);
            } catch (Exception e) {
                log.warn("事件监听器清理策略缓存失败: userId={}", uid, e);
            }

            // 5. 异步发布画像预热重建事件
            try {
                eventPublisher.publishEvent(new MirrorPersonaRebuildEvent(this, uid));
            } catch (Exception e) {
                log.warn("事件监听器发布画像重建事件失败: userId={}", uid, e);
            }
        }

        // 5. 异步发送微信小程序订阅消息给离线用户
        try {
            String roomIdStr = String.valueOf(roomId);
            Set<Long> onlineUserIds = scoreWebSocket.getOnlineUserIds(roomIdStr);
            for (Long memberId : playerTotalMap.keySet()) {
                if (!onlineUserIds.contains(memberId)) {
                    User user = userMapper.selectById(memberId);
                    if (user != null && user.getOpenid() != null) {
                        cn.hutool.json.JSONObject data = new cn.hutool.json.JSONObject();
                        data.set("roomNo", room.getRoomNo());
                        data.set("settleTime", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                        subscribeMessageService.sendSubscribeMessage(user.getOpenid(), "template_id_settle", "pages/room/room", data);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("事件监听器发送封存订阅消息失败: roomId={}", roomId, e);
        }

        log.info("房间结算异步后续业务执行完成: roomId={}", roomId);
    }
}
