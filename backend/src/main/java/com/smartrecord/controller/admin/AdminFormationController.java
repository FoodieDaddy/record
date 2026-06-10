package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
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
    public Result<Page<Room>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(formationService.listFormations(page, size));
    }

    @Operation(summary = "编队详情")
    @GetMapping("/{id}")
    public Result<Room> detail(@PathVariable Long id) {
        return Result.ok(formationService.getDetail(id));
    }

    @Operation(summary = "编队成员列表")
    @GetMapping("/{id}/members")
    public Result<List<RoomMember>> members(@PathVariable Long id) {
        return Result.ok(formationService.getMembers(id));
    }
}
