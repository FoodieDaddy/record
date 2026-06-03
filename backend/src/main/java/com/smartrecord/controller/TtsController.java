package com.smartrecord.controller;

import com.smartrecord.common.BizException;
import com.smartrecord.service.TtsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;

@Slf4j
@RestController
@RequestMapping("/tts")
@RequiredArgsConstructor
@Tag(name = "语音合成", description = "TTS 语音播报")
public class TtsController {

    private final TtsService ttsService;

    @GetMapping("/audio")
    @Operation(summary = "文本转语音", description = "返回 MP3 音频流")
    public void tts(@RequestParam String text,
                    @RequestParam(required = false) String voice,
                    HttpServletResponse response) {
        if (text == null || text.trim().isEmpty() || text.length() > 200) {
            throw new BizException("文本无效或过长");
        }

        byte[] audio = ttsService.synthesize(text, voice);
        if (audio == null || audio.length == 0) {
            throw new BizException("TTS 合成失败");
        }

        try {
            response.setContentType("audio/mpeg");
            response.setContentLength(audio.length);
            response.setHeader("Cache-Control", "public, max-age=3600");
            response.getOutputStream().write(audio);
            response.getOutputStream().flush();
        } catch (Exception e) {
            log.error("写入 TTS 响应失败", e);
            throw new BizException("TTS 响应写入失败");
        }
    }
}
