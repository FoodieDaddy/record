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
     * 按场次聚合各玩家总分（用于缓存预热重建排行榜）
     */
    @Select("SELECT user_id, SUM(score) AS total FROM score WHERE session_id = #{sessionId} GROUP BY user_id")
    List<Map<String, Object>> selectAggregatedScores(@Param("sessionId") Long sessionId);
}
