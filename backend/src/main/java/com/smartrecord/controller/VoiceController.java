package com.smartrecord.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.smartrecord.common.Result;
import com.smartrecord.service.VoiceCatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * 音色目录 API
 */
@RestController
@RequestMapping("/voice")
@RequiredArgsConstructor
@Tag(name = "音色目录", description = "TTS 音色分类与列表")
public class VoiceController {

    private final VoiceCatalogService voiceCatalogService;

    @GetMapping("/catalog")
    @Operation(summary = "获取音色目录", description = "返回按分类分组的音色列表")
    public Result<JsonNode> getCatalog() {
        return Result.ok(voiceCatalogService.getCatalog());
    }

    @GetMapping("/preview")
    @Operation(summary = "试听音色", description = "返回预录制的音色试听音频")
    public void preview(@RequestParam String file, HttpServletResponse response) throws IOException {
        // 防止路径穿越（先 URL decode 再检查）
        String decoded = URLDecoder.decode(file, StandardCharsets.UTF_8);
        if (decoded.contains("..") || decoded.contains("/") || decoded.contains("\\")) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }
        Resource resource = new ClassPathResource("static/voices/" + decoded);
        if (!resource.exists()) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        response.setContentType("audio/mpeg");
        response.setHeader("Cache-Control", "public, max-age=86400");
        try (InputStream is = resource.getInputStream()) {
            is.transferTo(response.getOutputStream());
        }
    }
}
