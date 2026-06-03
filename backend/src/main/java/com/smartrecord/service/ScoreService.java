package com.smartrecord.service;

import com.smartrecord.dto.score.ChartDataResp;
import com.smartrecord.dto.score.ScoreBatchResp;
import com.smartrecord.dto.score.ScoreSubmitResp;
import com.smartrecord.dto.score.SessionScoreResp;
import com.smartrecord.dto.score.SubmitScoreReq;

import java.util.List;

public interface ScoreService {

    ScoreSubmitResp submitScore(Long userId, SubmitScoreReq req);

    SessionScoreResp getSessionScores(Long sessionId);

    /** 房间级接口：查找活跃场次后委托 */
    List<ScoreBatchResp.PlayerScoreVO> getRoomRanking(Long roomId);

    List<ScoreBatchResp> getRoomRecentScores(Long roomId, Integer count);

    /** 结束当前轮，开启新一轮 */
    void settleRoom(Long userId, Long roomId);

    /** 获取房间当前轮的折线图数据 */
    ChartDataResp getChartData(Long roomId);
}
