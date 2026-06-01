package com.mahjong.score.controller;

import com.mahjong.score.common.Result;
import com.mahjong.score.dto.user.LoginReq;
import com.mahjong.score.dto.user.LoginResp;
import com.mahjong.score.dto.user.UserInfoResp;
import com.mahjong.score.service.UserService;
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

    @Operation(summary = "更新用户信息", description = "更新昵称和头像")
    @PutMapping("/me")
    public Result<Void> updateCurrentUser(
            HttpServletRequest request,
            @Parameter(description = "昵称") @RequestParam(required = false) String nickname,
            @Parameter(description = "头像 URL") @RequestParam(required = false) String avatarUrl) {
        Long userId = (Long) request.getAttribute("currentUserId");
        userService.updateUserInfo(userId, nickname, avatarUrl);
        return Result.ok();
    }
}
