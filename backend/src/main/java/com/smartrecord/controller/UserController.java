package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.user.LoginReq;
import com.smartrecord.dto.user.LoginResp;
import com.smartrecord.dto.user.UpdateUserReq;
import com.smartrecord.dto.user.UserInfoResp;
import com.smartrecord.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "用户模块", description = "微信登录、用户信息")
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "微信登录", description = "使用 wx.login 获取的 code 换取 JWT Token")
    @PostMapping("/login")
    public Result<LoginResp> login(@Valid @RequestBody LoginReq req) {
        return Result.ok(userService.login(req));
    }

    @Operation(summary = "获取当前用户信息")
    @GetMapping("/me")
    public Result<UserInfoResp> getCurrentUser(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("currentUserId");
        return Result.ok(userService.getUserInfo(userId));
    }

    @Operation(summary = "更新用户信息", description = "支持 JSON body 和 query params 两种方式")
    @PutMapping("/me")
    public Result<Void> updateCurrentUser(
            HttpServletRequest request,
            @RequestBody(required = false) UpdateUserReq body,
            @Parameter(description = "昵称（query 方式）") @RequestParam(required = false) String nickname,
            @Parameter(description = "头像 URL（query 方式）") @RequestParam(required = false) String avatarUrl) {
        Long userId = (Long) request.getAttribute("currentUserId");
        // JSON body 优先
        String finalNickname = (body != null && body.getNickname() != null) ? body.getNickname() : nickname;
        String finalAvatarUrl = (body != null && body.getAvatarUrl() != null) ? body.getAvatarUrl() : avatarUrl;
        userService.updateUserInfo(userId, finalNickname, finalAvatarUrl);
        return Result.ok();
    }
}
