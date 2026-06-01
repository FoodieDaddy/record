package com.mahjong.score.service;

import com.mahjong.score.dto.room.CreateRoomReq;
import com.mahjong.score.dto.room.JoinRoomReq;
import com.mahjong.score.dto.room.RoomResp;

import java.util.List;

public interface RoomService {

    RoomResp createRoom(Long userId, CreateRoomReq req);

    RoomResp joinRoom(Long userId, JoinRoomReq req);

    RoomResp getRoomDetail(Long roomId);

    List<RoomResp> getMyRooms(Long userId);

    void quitRoom(Long userId, Long roomId);

    void dissolveRoom(Long userId, Long roomId);
}
