package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.BizException;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminFormationService {

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String ROOM_PREFIX = "sr:room:";

    /**
     * 编队列表（分页，支持 keyword 和 status 筛选）
     */
    public Page<Room> listFormations(int page, int size, String keyword, Integer status) {
        LambdaQueryWrapper<Room> wrapper = new LambdaQueryWrapper<Room>()
                .orderByDesc(Room::getCreatedAt);
        if (status != null) {
            wrapper.eq(Room::getStatus, status);
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(Room::getRoomNo, keyword)
                    .or().like(Room::getOwnerId, keyword));
        }
        return roomMapper.selectPage(new Page<>(page, size), wrapper);
    }

    /**
     * 编队详情
     */
    public Room getDetail(Long roomId) {
        return roomMapper.selectById(roomId);
    }

    /**
     * 获取编队成员列表
     */
    public List<RoomMember> getMembers(Long roomId) {
        return roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, roomId)
                        .orderByDesc(RoomMember::getJoinedAt));
    }

    /**
     * 封存编队：将编队状态设为已归档，清除 Redis 运行期数据
     */
    public void sealFormation(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) {
            throw new BizException(404, "编队不存在");
        }
        if (room.getStatus() == 1) {
            throw new BizException(400, "编队已封存");
        }
        // 更新数据库状态
        roomMapper.update(null, new LambdaUpdateWrapper<Room>()
                .eq(Room::getId, roomId)
                .set(Room::getStatus, 1));
        // 清除 Redis 运行期数据
        try {
            redisTemplate.delete(ROOM_PREFIX + roomId + ":data");
        } catch (Exception e) {
            log.warn("封存编队时清除 Redis 数据失败, roomId={}", roomId, e);
        }
        log.info("编队已封存: roomId={}", roomId);
    }

    /**
     * 强制解散编队：将编队状态设为已归档，清除 Redis 数据，移除所有成员
     */
    public void dissolveFormation(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) {
            throw new BizException(404, "编队不存在");
        }
        // 更新数据库状态
        roomMapper.update(null, new LambdaUpdateWrapper<Room>()
                .eq(Room::getId, roomId)
                .set(Room::getStatus, 1));
        // 移除所有成员
        roomMemberMapper.delete(new LambdaQueryWrapper<RoomMember>()
                .eq(RoomMember::getRoomId, roomId));
        // 清除 Redis 运行期数据
        try {
            redisTemplate.delete(ROOM_PREFIX + roomId + ":data");
        } catch (Exception e) {
            log.warn("解散编队时清除 Redis 数据失败, roomId={}", roomId, e);
        }
        log.info("编队已强制解散: roomId={}", roomId);
    }
}
