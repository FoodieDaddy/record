package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.dto.user.*;
import com.smartrecord.service.IdentityLevelService;
import com.smartrecord.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "用户模块", description = "微信登录、用户信息")
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final IdentityLevelService identityLevelService;

    @Operation(summary = "微信登录", description = "使用 wx.login 获取的 code 换取 JWT Token")
    @PostMapping("/login")
    public Result<LoginResp> login(@Valid @RequestBody LoginReq req) {
        return Result.ok(userService.login(req));
    }

    @Operation(summary = "获取当前用户信息")
    @GetMapping("/me")
    public Result<UserInfoResp> getCurrentUser(@CurrentUser Long userId) {
        return Result.ok(userService.getUserInfo(userId));
    }

    @Operation(summary = "更新用户信息")
    @PutMapping("/me")
    public Result<Void> updateCurrentUser(
            @CurrentUser Long userId,
            @Valid @RequestBody UpdateUserReq req) {
        userService.updateUserInfo(userId, req);
        return Result.ok();
    }

    @Operation(summary = "获取用户设置")
    @GetMapping("/detail")
    public Result<UserDetailResp> getUserDetail(@CurrentUser Long userId) {
        return Result.ok(userService.getUserDetail(userId));
    }

    @Operation(summary = "更新用户设置")
    @PutMapping("/detail")
    public Result<Void> updateUserDetail(
            @CurrentUser Long userId,
            @RequestBody UpdateUserDetailReq req) {
        userService.updateUserDetail(userId, req);
        return Result.ok();
    }

    @Operation(summary = "获取身份等级")
    @GetMapping("/identity-level")
    public Result<IdentityLevelResp> getIdentityLevel(@CurrentUser Long userId) {
        return Result.ok(identityLevelService.getIdentityLevel(userId));
    }

    @Operation(summary = "获取个人生涯复盘数据", description = "获取用户生涯复盘驾驶舱汇总数据（包含总局数、胜率、拍档与宿敌）")
    @GetMapping("/career-cockpit")
    public Result<CareerCockpitResp> getCareerCockpit(@CurrentUser Long userId) {
        return Result.ok(userService.getCareerCockpit(userId));
    }
}
