package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.dto.storage.PresignUrlResp;
import com.smartrecord.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "存储模块", description = "通用存储预签名 URL 签发（支持多 provider 切换）")
@RestController
@RequestMapping("/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storageService;

    @Operation(
            summary = "获取预签名上传 URL",
            description = "后端根据 storage.provider 配置签发上传凭证；aliyun 模式返回预签名 PUT URL，cloudbase/cos 模式仅返回 provider 标识（前端直传云存储）"
    )
    @GetMapping("/presign")
    public Result<PresignUrlResp> getPresignUrl(
            @CurrentUser Long userId,
            @Parameter(description = "文件 Content-Type", example = "image/jpeg")
            @RequestParam String contentType,
            @Parameter(description = "文件大小，单位 byte", example = "524288")
            @RequestParam(required = false) Long contentLength) {
        return Result.ok(storageService.generatePresignUrl(contentType, contentLength));
    }
}
