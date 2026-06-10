package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.BizException;
import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminCreateReq;
import com.smartrecord.entity.Admin;
import com.smartrecord.mapper.AdminMapper;
import com.smartrecord.service.admin.AdminAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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

    @Operation(summary = "管理员列表")
    @GetMapping
    public Result<Page<Admin>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(adminMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<Admin>().orderByDesc(Admin::getCreatedAt)));
    }

    @Operation(summary = "创建管理员")
    @PostMapping
    public Result<Void> create(@Valid @RequestBody AdminCreateReq req) {
        adminAuthService.createAdmin(req.getUsername(), req.getPassword(), req.getRole());
        return Result.ok();
    }

    @Operation(summary = "管理员详情")
    @GetMapping("/{id}")
    public Result<Admin> detail(@PathVariable Long id) {
        Admin admin = adminMapper.selectById(id);
        if (admin == null) {
            throw new BizException("管理员不存在");
        }
        return Result.ok(admin);
    }

    @Operation(summary = "修改管理员状态")
    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        Admin admin = adminMapper.selectById(id);
        if (admin == null) {
            throw new BizException("管理员不存在");
        }
        admin.setStatus(status);
        adminMapper.updateById(admin);
        return Result.ok();
    }
}
