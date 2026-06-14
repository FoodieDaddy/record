package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.util.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "认证刷新")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthRefreshController {

    private final JwtUtil jwtUtil;

    @Operation(summary = "刷新 Token", description = "使用当前有效 Token 换取新 Token")
    @PostMapping("/refresh")
    public Result<Map<String, String>> refreshToken(@CurrentUser Long userId) {
        String newToken = jwtUtil.generateToken(userId);
        return Result.ok(Map.of("token", newToken));
    }
}
