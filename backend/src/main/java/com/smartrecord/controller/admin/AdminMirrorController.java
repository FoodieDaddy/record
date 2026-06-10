package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.service.admin.AdminMirrorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Admin 镜像档案")
@RestController
@RequestMapping("/admin/mirrors")
@RequiredArgsConstructor
public class AdminMirrorController {

    private final AdminMirrorService mirrorService;

    @Operation(summary = "镜像档案列表")
    @GetMapping
    public Result<Page<UserMirrorProfile>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(mirrorService.listProfiles(page, size));
    }

    @Operation(summary = "镜像档案详情")
    @GetMapping("/{userId}")
    public Result<UserMirrorProfile> detail(@PathVariable Long userId) {
        return Result.ok(mirrorService.getDetail(userId));
    }
}
