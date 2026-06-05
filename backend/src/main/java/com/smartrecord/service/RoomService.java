package com.smartrecord.service;

import com.smartrecord.dto.room.CreateRoomReq;
import com.smartrecord.dto.room.JoinRoomReq;
import com.smartrecord.dto.room.RoomResp;
import com.smartrecord.dto.room.UpdateSettingsReq;

import java.util.List;

public interface RoomService {

    RoomResp createRoom(Long userId, CreateRoomReq req);

    RoomResp joinRoom(Long userId, JoinRoomReq req);

    RoomResp getRoomDetail(Long roomId);

    List<RoomResp> getMyRooms(Long userId);

    void quitRoom(Long userId, Long roomId);

    void dissolveRoom(Long userId, Long roomId);

    List<RoomResp> getHistory(Long userId);

    void updateSettings(Long userId, Long roomId, UpdateSettingsReq req);
}
