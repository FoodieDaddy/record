package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.BizException;
import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminCreateReq;
import com.smartrecord.dto.admin.AdminResp;
import com.smartrecord.entity.Admin;
import com.smartrecord.mapper.AdminMapper;
import com.smartrecord.service.admin.AdminAuthService;
import com.smartrecord.aop.CurrentUser;
import com.smartrecord.event.SecurityActionEvent;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

/**
 * 管理员账号管理
 */
@Tag(name = "Admin 管理员管理")
@RestController
@RequestMapping("/admin/admins")
@RequiredArgsConstructor
public class AdminAdminController {

    private final AdminMapper adminMapper;
    private final AdminAuthService adminAuthService;
    private final ApplicationEventPublisher eventPublisher;

    @Operation(summary = "管理员列表")
    @GetMapping
    public Result<?> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Admin> adminPage = adminMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<Admin>().orderByDesc(Admin::getCreatedAt));
        return Result.ok(adminPage.convert(AdminResp::from));
    }

    @Operation(summary = "创建管理员")
    @PostMapping
    public Result<Void> create(@Valid @RequestBody AdminCreateReq req,
                               @CurrentUser Long adminId, HttpServletRequest request) {
        adminAuthService.createAdmin(req.getUsername(), req.getPassword(), req.getRole());
        eventPublisher.publishEvent(new SecurityActionEvent(this, adminId, "CREATE_ADMIN", "ADMIN", req.getUsername(), request.getRemoteAddr(), "成功"));
        return Result.ok();
    }

    @Operation(summary = "管理员详情")
    @GetMapping("/{id}")
    public Result<AdminResp> detail(@PathVariable Long id) {
        Admin admin = adminMapper.selectById(id);
        if (admin == null) {
            throw new BizException("管理员不存在");
        }
        return Result.ok(AdminResp.from(admin));
    }

    @Operation(summary = "修改管理员状态")
    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status,
                                     @CurrentUser Long adminId, HttpServletRequest request) {
        Admin admin = adminMapper.selectById(id);
        if (admin == null) {
            throw new BizException("管理员不存在");
        }
        admin.setStatus(status);
        adminMapper.updateById(admin);
        eventPublisher.publishEvent(new SecurityActionEvent(this, adminId, "UPDATE_STATUS", "ADMIN", String.valueOf(id), request.getRemoteAddr(), "成功"));
        return Result.ok();
    }
}
