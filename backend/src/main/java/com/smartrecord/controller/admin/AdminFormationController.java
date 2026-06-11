package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminFormationResp;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.service.admin.AdminFormationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Admin 编队管理")
@RestController
@RequestMapping("/admin/formations")
@RequiredArgsConstructor
public class AdminFormationController {

    private final AdminFormationService formationService;

    @Operation(summary = "编队列表")
    @GetMapping
    public Result<?> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Room> roomPage = formationService.listFormations(page, size);
        return Result.ok(roomPage.convert(AdminFormationResp::from));
    }

    @Operation(summary = "编队详情")
    @GetMapping("/{id}")
    public Result<AdminFormationResp> detail(@PathVariable Long id) {
        Room room = formationService.getDetail(id);
        return Result.ok(AdminFormationResp.from(room));
    }

    @Operation(summary = "编队成员列表")
    @GetMapping("/{id}/members")
    public Result<List<RoomMember>> members(@PathVariable Long id) {
        return Result.ok(formationService.getMembers(id));
    }
}
