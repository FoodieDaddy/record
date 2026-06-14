package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.BizException;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserMapper userMapper;
    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;

    public Page<User> listUsers(int page, int size, String keyword, Integer status) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(User::getNickname, keyword);
        }
        if (status != null) {
            wrapper.eq(User::getStatus, status);
        }
        wrapper.orderByDesc(User::getCreatedAt);
        return userMapper.selectPage(new Page<>(page, size), wrapper);
    }

    public User getUserDetail(Long userId) {
        return userMapper.selectById(userId);
    }

    /**
     * 修改用户状态
     */
    public void updateUserStatus(Long userId, Integer status) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException("用户不存在");
        }
        user.setStatus(status);
        userMapper.updateById(user);
    }

    /**
     * 批量删除用户
     */
    public void batchDeleteUsers(List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return;
        userMapper.deleteBatchIds(userIds);
    }

    /**
     * 获取用户参与的编队列表（最近 20 条）
     */
    public List<Map<String, Object>> getUserFormations(Long userId) {
        List<RoomMember> memberships = roomMemberMapper.selectList(
            new LambdaQueryWrapper<RoomMember>()
                .eq(RoomMember::getUserId, userId)
                .orderByDesc(RoomMember::getJoinedAt)
                .last("LIMIT 20")
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (RoomMember rm : memberships) {
            Room room = roomMapper.selectById(rm.getRoomId());
            if (room != null) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("roomId", room.getId());
                item.put("roomNo", room.getRoomNo());
                item.put("scoreMode", room.getScoreMode());
                item.put("status", room.getStatus());
                item.put("finalScore", rm.getFinalScore());
                item.put("joinedAt", rm.getJoinedAt());
                result.add(item);
            }
        }
        return result;
    }
}
