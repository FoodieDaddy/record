package com.mahjong.score.service;

import com.mahjong.score.dto.score.ScoreBatchResp;
import com.mahjong.score.dto.score.SessionScoreResp;
import com.mahjong.score.dto.score.SubmitScoreReq;

import java.util.List;

public interface ScoreService {

    void submitScore(Long userId, SubmitScoreReq req);

    SessionScoreResp getSessionScores(Long sessionId);

    List<ScoreBatchResp> getRecentScores(Long sessionId, Integer count);

    List<ScoreBatchResp.PlayerScoreVO> getRanking(Long sessionId);
}
