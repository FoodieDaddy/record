package com.mahjong.score.controller;

import com.mahjong.score.common.Result;
import com.mahjong.score.dto.storage.BatchPresignReq;
import com.mahjong.score.dto.storage.PresignUrlResp;
import com.mahjong.score.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "存储模块", description = "MinIO 预签名 URL 签发（前端直传）")
@RestController
@RequestMapping("/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storageService;

    @Operation(
            summary = "获取单个预签名上传 URL",
            description = "后端生成 MinIO 预签名 PUT URL，前端拿到后直接 PUT 上传图片，无需经过后端中转"
    )
    @GetMapping("/presign")
    public Result<PresignUrlResp> getPresignUrl(
            @Parameter(description = "文件 Content-Type", example = "image/jpeg")
            @RequestParam String contentType) {
        return Result.ok(storageService.generatePresignUrl(contentType));
    }

    @Operation(
            summary = "批量获取预签名上传 URL",
            description = "一次获取多个预签名 URL，用于记分时附带多张图片的场景"
    )
    @PostMapping("/presign/batch")
    public Result<List<PresignUrlResp>> batchPresignUrls(@Valid @RequestBody BatchPresignReq req) {
        return Result.ok(storageService.batchGeneratePresignUrls(req));
    }

    @Operation(summary = "直接上传文件", description = "前端 multipart 上传，后端转存 MinIO，返回访问 URL")
    @PostMapping("/upload")
    public Result<String> upload(@RequestParam("file") MultipartFile file) {
        return Result.ok(storageService.uploadFile(file));
    }
}
