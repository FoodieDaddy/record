package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.entity.User;
import com.smartrecord.service.admin.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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
}
