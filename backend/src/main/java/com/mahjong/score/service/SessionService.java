package com.mahjong.score.service;

import com.mahjong.score.dto.session.CreateSessionReq;
import com.mahjong.score.dto.session.SessionResp;

import java.util.List;

public interface SessionService {

    SessionResp createSession(Long userId, CreateSessionReq req);

    List<SessionResp> getSessionsByRoom(Long roomId, Integer page, Integer size);

    SessionResp getSessionDetail(Long sessionId);

    void settleSession(Long userId, Long sessionId);
}
