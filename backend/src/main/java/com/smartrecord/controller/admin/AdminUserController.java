package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminUserResp;
import com.smartrecord.entity.User;
import com.smartrecord.service.admin.AdminUserService;
import com.smartrecord.aop.CurrentUser;
import com.smartrecord.event.SecurityActionEvent;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Map;

@Tag(name = "Admin 用户管理")
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService userService;
    private final ApplicationEventPublisher eventPublisher;

    @Operation(summary = "用户列表")
    @GetMapping
    public Result<?> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        Page<User> userPage = userService.listUsers(page, size, keyword, status);
        return Result.ok(userPage.convert(AdminUserResp::from));
    }

    @Operation(summary = "用户详情")
    @GetMapping("/{id}")
    public Result<AdminUserResp> detail(@PathVariable Long id) {
        User user = userService.getUserDetail(id);
        return Result.ok(AdminUserResp.from(user));
    }

    @Operation(summary = "修改用户状态")
    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status,
                                     @CurrentUser Long adminId, HttpServletRequest request) {
        userService.updateUserStatus(id, status);
        eventPublisher.publishEvent(new SecurityActionEvent(this, adminId, "UPDATE_STATUS", "USER", String.valueOf(id), request.getRemoteAddr(), "成功"));
        return Result.ok();
    }

    @Operation(summary = "批量修改用户状态")
    @PutMapping("/batch-status")
    public Result<Void> batchUpdateStatus(@RequestBody List<Long> userIds, @RequestParam Integer status,
                                          @CurrentUser Long adminId, HttpServletRequest request) {
        for (Long userId : userIds) {
            userService.updateUserStatus(userId, status);
        }
        eventPublisher.publishEvent(new SecurityActionEvent(this, adminId, "BATCH_UPDATE_STATUS", "USER", userIds.toString(), request.getRemoteAddr(), "成功"));
        return Result.ok();
    }

    @Operation(summary = "批量删除用户")
    @DeleteMapping("/batch")
    public Result<Void> batchDelete(@RequestBody List<Long> userIds,
                                    @CurrentUser Long adminId, HttpServletRequest request) {
        userService.batchDeleteUsers(userIds);
        eventPublisher.publishEvent(new SecurityActionEvent(this, adminId, "BATCH_DELETE", "USER", userIds.toString(), request.getRemoteAddr(), "成功"));
        return Result.ok();
    }

    @Operation(summary = "用户参与的编队列表")
    @GetMapping("/{id}/formations")
    public Result<List<Map<String, Object>>> userFormations(@PathVariable Long id) {
        return Result.ok(userService.getUserFormations(id));
    }
}
