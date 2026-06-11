package com.smartrecord.controller.admin;

import com.alibaba.csp.sentinel.annotation.SentinelResource;
import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminLoginReq;
import com.smartrecord.dto.admin.AdminLoginResp;
import com.smartrecord.dto.admin.ChangePasswordReq;
import com.smartrecord.service.admin.AdminAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "管理员认证")
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    @Operation(summary = "管理员登录")
    @SentinelResource(value = "admin-login", blockHandler = "loginBlockHandler")
    @PostMapping("/login")
    public Result<AdminLoginResp> login(@Valid @RequestBody AdminLoginReq req) {
        return Result.ok(adminAuthService.login(req));
    }

    /**
     * Sentinel 限流降级处理
     */
    public Result<AdminLoginResp> loginBlockHandler(AdminLoginReq req, com.alibaba.csp.sentinel.slots.block.BlockException ex) {
        return Result.fail(429, "登录请求过于频繁，请稍后再试");
    }

    @Operation(summary = "修改密码")
    @PutMapping("/password")
    public Result<Void> changePassword(@CurrentUser Long adminId,
                                        @Valid @RequestBody ChangePasswordReq req) {
        adminAuthService.changePassword(adminId, req.getOldPassword(), req.getNewPassword());
        return Result.ok(null);
    }
}
