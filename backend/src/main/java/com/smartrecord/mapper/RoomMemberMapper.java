package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.RoomMember;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

public interface RoomMemberMapper extends BaseMapper<RoomMember> {

    @Select("SELECT user_id, final_score AS total FROM room_member WHERE room_id = #{roomId} AND final_score IS NOT NULL")
    List<Map<String, Object>> selectFinalScoresByRoomId(@Param("roomId") Long roomId);

    @Select("""
            SELECT rm.room_id AS roomId, rm.final_score AS netScore, rm.quit_time AS latestAt
            FROM room_member rm
            JOIN room r ON r.id = rm.room_id
            WHERE rm.user_id = #{userId}
              AND rm.quit_time IS NOT NULL
              AND r.status = 1
            ORDER BY rm.quit_time DESC
            LIMIT #{limit}
            """)
    List<Map<String, Object>> selectTrendByUserId(@Param("userId") Long userId, @Param("limit") int limit);

    @Select("""
            SELECT COUNT(DISTINCT rm.room_id)
            FROM room_member rm
            JOIN room r ON r.id = rm.room_id
            WHERE rm.user_id = #{userId}
              AND rm.quit_time IS NOT NULL
              AND r.status = 1
            """)
    int countSettledRooms(@Param("userId") Long userId);

    @Select("""
            SELECT rm.room_id
            FROM room_member rm
            JOIN room r ON r.id = rm.room_id
            WHERE rm.user_id = #{userId}
              AND rm.quit_time IS NOT NULL
              AND r.status = 1
            ORDER BY rm.quit_time DESC
            LIMIT #{limit}
            """)
    List<Long> selectUserRoomIds(@Param("userId") Long userId, @Param("limit") int limit);

    @Select("""
            SELECT rm.*
            FROM room_member rm
            JOIN room r ON r.id = rm.room_id
            WHERE rm.user_id = #{userId}
              AND rm.quit_time IS NOT NULL
              AND r.status = 1
            """)
    List<RoomMember> selectSettledMembersByUserId(@Param("userId") Long userId);
}
