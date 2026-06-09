package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.dto.storage.PresignUrlResp;
import com.smartrecord.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "存储模块", description = "阿里云 OSS 预签名 URL 签发（前端直传）")
@RestController
@RequestMapping("/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storageService;

    @Operation(
            summary = "获取单个预签名上传 URL",
            description = "后端生成阿里云 OSS 预签名 PUT URL，前端拿到后直接 PUT 上传图片，无需经过后端中转"
    )
    @GetMapping("/presign")
    public Result<PresignUrlResp> getPresignUrl(
            HttpServletRequest request,
            @Parameter(description = "文件 Content-Type", example = "image/jpeg")
            @RequestParam String contentType,
            @Parameter(description = "文件大小，单位 byte", example = "524288")
            @RequestParam(required = false) Long contentLength) {
        // 需要登录才能获取上传凭证
        Long userId = (Long) request.getAttribute("currentUserId");
        if (userId == null) {
            return Result.fail(401, "请先登录");
        }
        return Result.ok(storageService.generatePresignUrl(contentType, contentLength));
    }

}
