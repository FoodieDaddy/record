package com.mahjong.score.service;

import com.mahjong.score.dto.score.ScoreBatchResp;
import com.mahjong.score.dto.score.ScoreSubmitResp;
import com.mahjong.score.dto.score.SessionScoreResp;
import com.mahjong.score.dto.score.SubmitScoreReq;

import java.util.List;

public interface ScoreService {

    ScoreSubmitResp submitScore(Long userId, SubmitScoreReq req);

    SessionScoreResp getSessionScores(Long sessionId);

    /** 房间级接口：查找活跃场次后委托 */
    List<ScoreBatchResp.PlayerScoreVO> getRoomRanking(Long roomId);

    List<ScoreBatchResp> getRoomRecentScores(Long roomId, Integer count);

    /** 结束当前轮，开启新一轮 */
    void settleRoom(Long userId, Long roomId);
}
