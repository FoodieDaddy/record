package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.service.RoomAccessGuard;
import com.smartrecord.dto.room.CreateRoomReq;
import com.smartrecord.dto.room.JoinRoomReq;
import com.smartrecord.dto.room.RoomResp;
import com.smartrecord.dto.room.UpdateSettingsReq;
import com.smartrecord.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.smartrecord.aop.CurrentUser;
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
    private final RoomAccessGuard roomAccessGuard;

    @Operation(summary = "创建房间", description = "房主建房，后端生成唯一房间号和专属小程序码")
    @PostMapping
    public Result<RoomResp> createRoom(
            @Valid @RequestBody CreateRoomReq req,
            @CurrentUser Long userId) {
        return Result.ok(roomService.createRoom(userId, req));
    }

    @Operation(summary = "加入房间", description = "通过房间号或扫码加入房间。scanRoomNo 来自小程序码携带的 scene 参数")
    @PostMapping("/join")
    public Result<RoomResp> joinRoom(
            @Valid @RequestBody JoinRoomReq req,
            @CurrentUser Long userId) {
        return Result.ok(roomService.joinRoom(userId, req));
    }

    @Operation(summary = "获取房间详情", description = "包含成员列表、小程序码 URL")
    @GetMapping("/{roomId}")
    public Result<RoomResp> getRoomDetail(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @CurrentUser Long userId) {
        roomAccessGuard.assertRoomMember(roomId, userId);
        return Result.ok(roomService.getRoomDetail(roomId));
    }

    @Operation(summary = "获取我的房间列表", description = "当前用户参与的所有房间")
    @GetMapping("/my")
    public Result<List<RoomResp>> getMyRooms(@CurrentUser Long userId) {
        return Result.ok(roomService.getMyRooms(userId));
    }

    @Operation(summary = "退出房间", description = "普通成员退出房间；房主退出等同于解散房间")
    @DeleteMapping("/{roomId}/quit")
    public Result<Void> quitRoom(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @CurrentUser Long userId) {
        roomService.quitRoom(userId, roomId);
        return Result.ok();
    }

    @Operation(summary = "历史房间", description = "当前用户参与过的已结算房间")
    @GetMapping("/history")
    public Result<List<RoomResp>> getHistory(@CurrentUser Long userId) {
        return Result.ok(roomService.getHistory(userId));
    }

    @Operation(summary = "更新记分设置", description = "仅房主可操作，修改本局录入方式、信任模式、零和模式、超时设置")
    @PutMapping("/{roomId}/settings")
    public Result<Void> updateSettings(
            @Parameter(description = "房间 ID") @PathVariable Long roomId,
            @Valid @RequestBody UpdateSettingsReq req,
            @CurrentUser Long userId) {
        roomService.updateSettings(userId, roomId, req);
        return Result.ok();
    }
}
