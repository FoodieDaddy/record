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
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        Page<Room> roomPage = formationService.listFormations(page, size, keyword, status);
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

    @Operation(summary = "封存编队")
    @PostMapping("/{id}/seal")
    public Result<Void> seal(@PathVariable Long id) {
        formationService.sealFormation(id);
        return Result.ok();
    }

    @Operation(summary = "强制解散编队")
    @PostMapping("/{id}/dissolve")
    public Result<Void> dissolve(@PathVariable Long id) {
        formationService.dissolveFormation(id);
        return Result.ok();
    }
}
