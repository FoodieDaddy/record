package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.entity.User;
import com.smartrecord.service.admin.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Admin 用户管理")
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService userService;

    @Operation(summary = "用户列表")
    @GetMapping
    public Result<Page<User>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        return Result.ok(userService.listUsers(page, size, keyword));
    }

    @Operation(summary = "用户详情")
    @GetMapping("/{id}")
    public Result<User> detail(@PathVariable Long id) {
        return Result.ok(userService.getUserDetail(id));
    }

    @Operation(summary = "修改用户状态")
    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        userService.updateUserStatus(id, status);
        return Result.ok();
    }

    @Operation(summary = "批量修改用户状态")
    @PutMapping("/batch-status")
    public Result<Void> batchUpdateStatus(@RequestBody List<Long> userIds, @RequestParam Integer status) {
        for (Long userId : userIds) {
            userService.updateUserStatus(userId, status);
        }
        return Result.ok();
    }

    @Operation(summary = "批量删除用户")
    @DeleteMapping("/batch")
    public Result<Void> batchDelete(@RequestBody List<Long> userIds) {
        userService.batchDeleteUsers(userIds);
        return Result.ok();
    }

    @Operation(summary = "用户参与的编队列表")
    @GetMapping("/{id}/formations")
    public Result<List<Map<String, Object>>> userFormations(@PathVariable Long id) {
        return Result.ok(userService.getUserFormations(id));
    }
}
