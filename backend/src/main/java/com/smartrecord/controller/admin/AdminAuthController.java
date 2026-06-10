package com.smartrecord.controller.admin;

import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminLoginReq;
import com.smartrecord.dto.admin.AdminLoginResp;
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
    @PostMapping("/login")
    public Result<AdminLoginResp> login(@Valid @RequestBody AdminLoginReq req) {
        return Result.ok(adminAuthService.login(req));
    }
}
