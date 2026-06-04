package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.room.CreateRoomReq;
import com.smartrecord.dto.room.JoinRoomReq;
import com.smartrecord.dto.room.RearrangeSeatsReq;
import com.smartrecord.dto.room.RoomResp;
import com.smartrecord.dto.room.SwapSeatReq;
import com.smartrecord.dto.room.UpdateLayoutReq;
import com.smartrecord.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "房间模块", description = "建房、加入房间、房间信息、专属小程序码")
@RestController
@RequestMapping("/room")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @Operation(summary = "创建房间", description = "房主建房，后端生成唯一房间号和专属小程序码")
    @PostMapping
    public Result<RoomResp> createRoom(
            HttpServletRequest request,
            @Valid @RequestBody CreateRoomReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roomService.createRoom(userId, req));
    }

    @Operation(summary = "加入房间", description = "通过房间号或扫码加入房间。scanRoomNo 来自小程序码携带的 scene 参数")
    @PostMapping("/join")
    public Result<RoomResp> joinRoom(
            HttpServletRequest request,
            @Valid @RequestBody JoinRoomReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roomService.joinRoom(userId, req));
    }

    @Operation(summary = "获取房间详情", description = "包含成员列表、小程序码 URL")
    @GetMapping("/{roomId}")
    public Result<RoomResp> getRoomDetail(
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        return Result.ok(roomService.getRoomDetail(roomId));
    }

    @Operation(summary = "获取我的房间列表", description = "当前用户参与的所有房间")
    @GetMapping("/my")
    public Result<List<RoomResp>> getMyRooms(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roomService.getMyRooms(userId));
    }

    @Operation(summary = "退出房间", description = "普通成员退出房间；房主退出等同于解散房间")
    @DeleteMapping("/{roomId}/quit")
    public Result<Void> quitRoom(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomService.quitRoom(userId, roomId);
        return Result.ok();
    }

    @Operation(summary = "换座", description = "切换到目标空座位，WebSocket 广播给同房间玩家")
    @PostMapping("/{roomId}/swap-seat")
    public Result<Void> swapSeat(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Valid @RequestBody SwapSeatReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomService.swapSeat(userId, roomId, req.getTargetSeatNo());
        return Result.ok();
    }

    @Operation(summary = "房主调整座位", description = "仅房主可操作，批量调整成员座位，WebSocket 广播")
    @PostMapping("/{roomId}/rearrange-seats")
    public Result<Void> rearrangeSeats(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Valid @RequestBody RearrangeSeatsReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomService.rearrangeSeats(userId, roomId, req.getAssignments());
        return Result.ok();
    }

    @Operation(summary = "历史房间", description = "当前用户参与过的已结算房间")
    @GetMapping("/history")
    public Result<List<RoomResp>> getHistory(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(roomService.getHistory(userId));
    }

    @Operation(summary = "更新座位布局", description = "仅房主可操作，切换座位排列方式")
    @PutMapping("/{roomId}/layout")
    public Result<Void> updateLayout(
            HttpServletRequest request,
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Valid @RequestBody UpdateLayoutReq req) {
        Long userId = (Long) request.getAttribute("currentUserId");
        roomService.updateLayout(userId, roomId, req.getLayoutType());
        return Result.ok();
    }
}
