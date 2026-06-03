package com.smartrecord.service;

import com.smartrecord.dto.session.CreateSessionReq;
import com.smartrecord.dto.session.SessionResp;

import java.util.List;

public interface SessionService {

    SessionResp createSession(Long userId, CreateSessionReq req);

    List<SessionResp> getSessionsByRoom(Long roomId, Integer page, Integer size);

}
