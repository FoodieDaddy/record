package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.Score;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

public interface ScoreMapper extends BaseMapper<Score> {

    void insertBatch(@Param("list") List<Score> scores);

    /**
     * 按房间聚合各玩家总分
     */
    @Select("SELECT user_id, SUM(score) AS total FROM score WHERE room_id = #{roomId} GROUP BY user_id")
    List<Map<String, Object>> selectAggregatedScores(@Param("roomId") Long roomId);

    /**
     * 查询用户最近 N 场得分（按时间倒序）
     */
    @Select("SELECT score FROM score WHERE user_id = #{userId} ORDER BY created_at DESC LIMIT #{limit}")
    List<Integer> selectRecentScores(@Param("userId") Long userId, @Param("limit") int limit);

    /**
     * 查询用户最近 N 个房间的聚合得分（按最近活动时间倒序）
     */
    @Select("SELECT room_id AS roomId, SUM(score) AS netScore, MAX(created_at) AS latestAt " +
            "FROM score WHERE user_id = #{userId} GROUP BY room_id ORDER BY latestAt DESC LIMIT #{limit}")
    List<Map<String, Object>> selectTrendByUserId(@Param("userId") Long userId, @Param("limit") int limit);
}
