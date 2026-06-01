package com.mahjong.score.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mahjong.score.entity.Score;
import com.mahjong.score.entity.Session;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

public interface SessionMapper extends BaseMapper<Session> {

    @Select("SELECT id, session_id, room_id, user_id, score, created_by, created_at FROM score WHERE session_id = #{sessionId} ORDER BY created_at")
    List<Score> selectScoreBySessionId(@Param("sessionId") Long sessionId);

    /**
     * 已结算场次：从 score 表聚合各玩家总分
     */
    @Select("SELECT user_id, SUM(score) as total FROM score WHERE session_id = #{sessionId} GROUP BY user_id")
    List<Map<String, Object>> selectPlayerTotals(@Param("sessionId") Long sessionId);

    default Map<Long, Integer> getPlayerTotalsBySessionId(Long sessionId) {
        List<Map<String, Object>> rows = selectPlayerTotals(sessionId);
        Map<Long, Integer> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Long userId = ((Number) row.get("user_id")).longValue();
            Integer total = ((Number) row.get("total")).intValue();
            result.put(userId, total);
        }
        return result;
    }
}
