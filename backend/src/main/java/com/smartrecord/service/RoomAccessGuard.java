package com.smartrecord.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 编队访问守卫 — 校验用户是否为指定房间成员。
 * 优先使用 Redis 活跃成员快照，归档/历史读取回落到 MySQL 成员记录。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomAccessGuard {

    private static final String ROOM_PREFIX = "sr:room:";

    private final StringRedisTemplate redisTemplate;
    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;

    /**
     * 校验用户是否为房间活跃成员，不满足条件抛出 BizException(403)。
     */
    public void assertRoomMember(Long roomId, Long userId) {
        if (roomId == null || userId == null) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权访问该编队");
        }
        if (!isActiveRoomMember(roomId, userId)) {
            log.warn("编队访问被拒绝: roomId={}, userId={}", roomId, userId);
            throw new BizException(ErrorCode.FORBIDDEN, "无权访问该编队");
        }
    }

    private boolean isActiveRoomMember(Long roomId, Long userId) {
        String dataKey = ROOM_PREFIX + roomId + ":data";
        if (Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(dataKey, "a:" + userId))) {
            return true;
        }

        Room room = roomMapper.selectById(roomId);
        if (room == null) {
            return false;
        }

        LambdaQueryWrapper<RoomMember> query = new LambdaQueryWrapper<RoomMember>()
                .eq(RoomMember::getRoomId, roomId)
                .eq(RoomMember::getUserId, userId)
                .last("LIMIT 1");
        RoomMember member = roomMemberMapper.selectOne(query);
        if (member == null) {
            return false;
        }

        // 活跃房间只允许仍在席成员；归档房间允许历史成员查看归档数据。
        return Integer.valueOf(1).equals(room.getStatus()) || member.getQuitTime() == null;
    }
}
