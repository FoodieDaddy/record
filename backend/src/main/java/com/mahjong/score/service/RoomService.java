package com.mahjong.score.service;

import com.mahjong.score.dto.room.CreateRoomReq;
import com.mahjong.score.dto.room.JoinRoomReq;
import com.mahjong.score.dto.room.RearrangeSeatsReq;
import com.mahjong.score.dto.room.RoomResp;
import com.mahjong.score.dto.room.SwapSeatReq;

import java.util.List;

public interface RoomService {

    RoomResp createRoom(Long userId, CreateRoomReq req);

    RoomResp joinRoom(Long userId, JoinRoomReq req);

    RoomResp getRoomDetail(Long roomId);

    List<RoomResp> getMyRooms(Long userId);

    void quitRoom(Long userId, Long roomId);

    void dissolveRoom(Long userId, Long roomId);

    void swapSeat(Long userId, Long roomId, Integer targetSeatNo);

    void rearrangeSeats(Long userId, Long roomId, List<RearrangeSeatsReq.SeatAssignment> assignments);

    void updateLayout(Long userId, Long roomId, String layoutType);
}
