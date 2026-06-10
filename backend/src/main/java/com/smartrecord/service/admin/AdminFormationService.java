package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminFormationService {

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;

    /**
     * 编队列表（分页，按创建时间倒序）
     */
    public Page<Room> listFormations(int page, int size) {
        return roomMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<Room>().orderByDesc(Room::getCreatedAt));
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
}
