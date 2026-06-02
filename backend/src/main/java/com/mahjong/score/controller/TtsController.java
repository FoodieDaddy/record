package com.mahjong.score.controller;

import com.mahjong.score.common.BizException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
@RequestMapping("/tts")
@Tag(name = "语音合成", description = "TTS 语音播报")
public class TtsController {

    private static final String TTS_URL = "https://translate.google.com/translate_tts";

    @GetMapping("/audio")
    @Operation(summary = "文本转语音", description = "返回 MP3 音频流")
    public void tts(@RequestParam String text, jakarta.servlet.http.HttpServletResponse response) {
        if (text == null || text.trim().isEmpty() || text.length() > 200) {
            throw new BizException("文本无效或过长");
        }

        try {
            String encoded = URLEncoder.encode(text, StandardCharsets.UTF_8);
            String urlStr = TTS_URL
                    + "?ie=UTF-8"
                    + "&tl=zh-CN"
                    + "&client=tw-ob"
                    + "&q=" + encoded;

            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(10000);

            int code = conn.getResponseCode();
            if (code != 200) {
                log.warn("TTS 请求失败: status={}", code);
                throw new BizException("TTS 服务不可用");
            }

            response.setContentType("audio/mpeg");
            response.setHeader("Cache-Control", "public, max-age=3600");

            try (InputStream in = conn.getInputStream();
                 ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                byte[] tmp = new byte[4096];
                int len;
                while ((len = in.read(tmp)) != -1) {
                    buf.write(tmp, 0, len);
                }
                response.getOutputStream().write(buf.toByteArray());
                response.getOutputStream().flush();
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("TTS 合成失败", e);
            throw new BizException("TTS 合成失败");
        }
    }
}
