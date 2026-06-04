package com.smartrecord.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.smartrecord.common.BizException;
import com.smartrecord.common.Result;
import com.smartrecord.service.MimoTtsService;
import com.smartrecord.service.TtsService;
import com.smartrecord.service.VoiceCatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/tts")
@RequiredArgsConstructor
@Tag(name = "语音合成", description = "TTS 语音播报")
public class TtsController {

    private final TtsService ttsService;
    private final MimoTtsService mimoTtsService;
    private final VoiceCatalogService voiceCatalogService;

    @GetMapping("/audio")
    @Operation(summary = "文本转语音", description = "返回 MP3 音频流")
    public void tts(@RequestParam String text,
                    @RequestParam(required = false) String voice,
                    @RequestParam(required = false) String voiceId,
                    HttpServletResponse response) {
        if (text == null || text.trim().isEmpty() || text.length() > 200) {
            throw new BizException("文本无效或过长");
        }

        // 按 voiceId 查找完整配置（含 rate/pitch）
        String activeVoice = voice;
        String rate = null;
        String pitch = null;
        if (voiceId != null && !voiceId.isBlank()) {
            JsonNode v = voiceCatalogService.findVoiceById(voiceId);
            if (v != null) {
                activeVoice = v.path("voice").asText();
                rate = v.has("rate") ? v.path("rate").asText() : null;
                pitch = v.has("pitch") ? v.path("pitch").asText() : null;
            }
        }

        byte[] audio = ttsService.synthesize(text, activeVoice, rate, pitch);
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

    @GetMapping("/benchmark")
    @Operation(summary = "TTS 引擎对比测试", description = "并行调用 edge-tts 和 mimo-tts，返回耗时对比")
    public Result<Map<String, Object>> benchmark(@RequestParam String text,
                                                 @RequestParam(required = false) String mimoVoice) {
        if (text == null || text.trim().isEmpty() || text.length() > 200) {
            throw new BizException("文本无效或过长");
        }

        // edge-tts
        TtsService.SynthResult edgeResult = ttsService.synthesizeWithTiming(text, null, null, null);

        // mimo-tts
        MimoTtsService.SynthResult mimoResult = mimoTtsService.synthesize(text, mimoVoice);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("text", text);

        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("success", edgeResult.audio() != null);
        edge.put("edgeTtsMs", edgeResult.edgeTtsMs());
        edge.put("ffmpegMs", edgeResult.ffmpegMs());
        edge.put("totalMs", edgeResult.totalTimeMs());
        edge.put("audioSize", edgeResult.audio() != null ? edgeResult.audio().length : 0);
        data.put("edgeTts", edge);

        Map<String, Object> mimo = new LinkedHashMap<>();
        mimo.put("success", mimoResult.audio() != null);
        mimo.put("apiMs", mimoResult.apiTimeMs());
        mimo.put("ffmpegMs", mimoResult.ffmpegTimeMs());
        mimo.put("totalMs", mimoResult.totalTimeMs());
        mimo.put("rawSize", mimoResult.rawSize());
        mimo.put("audioSize", mimoResult.audio() != null ? mimoResult.audio().length : 0);
        mimo.put("voice", mimoVoice != null ? mimoVoice : "mimo_default");
        data.put("mimoTts", mimo);

        return Result.ok(data);
    }
}
