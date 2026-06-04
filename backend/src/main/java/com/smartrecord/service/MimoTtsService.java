package com.smartrecord.service;

import cn.hutool.http.Header;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 小米 MiMo TTS 语音合成 — 调用 mimo-v2.5-tts 模型生成 MP3
 */
@Slf4j
@Service
public class MimoTtsService {

    @Value("${app.llm.api-url:}")
    private String apiUrl;

    @Value("${app.llm.api-key:}")
    private String apiKey;

    @Value("${app.tts.mimo-voice:mimo_default}")
    private String defaultVoice;

    /** 可用音色列表 */
    public static final List<String> AVAILABLE_VOICES = List.of(
            "mimo_default", "冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean"
    );

    /**
     * 合成语音，返回 MP3 字节数组（标准 44.1kHz 128kbps 格式）
     *
     * @return 合成结果，包含各阶段耗时
     */
    public SynthResult synthesize(String text, String voice) {
        String activeVoice = (voice != null && !voice.isBlank()) ? voice : defaultVoice;
        long t0 = System.currentTimeMillis();

        // 1. 调用 MiMo TTS API
        byte[] rawAudio = callMimoTts(text, activeVoice);
        long t1 = System.currentTimeMillis();
        if (rawAudio == null || rawAudio.length == 0) {
            return new SynthResult(null, t1 - t0, 0, t1 - t0, 0);
        }

        // 2. ffmpeg 转码为标准 MP3
        byte[] converted = convertWithFfmpeg(rawAudio);
        long t2 = System.currentTimeMillis();

        byte[] finalAudio = (converted != null) ? converted : rawAudio;
        return new SynthResult(finalAudio, t1 - t0, t2 - t1, t2 - t0, rawAudio.length);
    }

    /**
     * 调用 MiMo TTS API，返回原始 MP3 字节
     */
    private byte[] callMimoTts(String text, String voice) {
        if (apiUrl == null || apiUrl.isEmpty() || apiKey == null || apiKey.isEmpty()) {
            log.warn("MiMo TTS API 未配置");
            return null;
        }

        JSONObject requestBody = new JSONObject();
        requestBody.set("model", "mimo-v2.5-tts");

        JSONArray messages = new JSONArray();
        JSONObject assistantMsg = new JSONObject();
        assistantMsg.set("role", "assistant");
        assistantMsg.set("content", text);
        messages.add(assistantMsg);
        requestBody.set("messages", messages);

        requestBody.set("modalities", List.of("text", "audio"));

        JSONObject audioConfig = new JSONObject();
        audioConfig.set("voice", voice);
        audioConfig.set("format", "mp3");
        requestBody.set("audio", audioConfig);

        try {
            HttpResponse response = HttpRequest.post(apiUrl)
                    .header(Header.AUTHORIZATION, "Bearer " + apiKey)
                    .header(Header.CONTENT_TYPE, "application/json")
                    .body(requestBody.toString())
                    .timeout(30000)
                    .execute();

            if (!response.isOk()) {
                log.warn("MiMo TTS API 返回非 200: status={}, body={}", response.getStatus(), response.body());
                return null;
            }

            JSONObject respJson = JSONUtil.parseObj(response.body());
            String audioData = respJson.getJSONArray("choices")
                    .getJSONObject(0)
                    .getJSONObject("message")
                    .getJSONObject("audio")
                    .getStr("data");

            if (audioData == null || audioData.isBlank()) {
                log.warn("MiMo TTS 返回空音频数据");
                return null;
            }

            return Base64.getDecoder().decode(audioData);
        } catch (Exception e) {
            log.error("MiMo TTS 调用异常", e);
            return null;
        }
    }

    /**
     * ffmpeg 转码为标准 MP3（44.1kHz 128kbps mono）
     */
    private byte[] convertWithFfmpeg(byte[] rawAudio) {
        String id = UUID.randomUUID().toString();
        String tmpDir = System.getProperty("java.io.tmpdir");
        String rawFile = tmpDir + "/mimo_tts_raw_" + id + ".mp3";
        String outFile = tmpDir + "/mimo_tts_out_" + id + ".mp3";

        try {
            Files.write(new File(rawFile).toPath(), rawAudio);

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", rawFile,
                    "-ar", "44100", "-ab", "128k", "-ac", "1", "-f", "mp3",
                    outFile
            );
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            byte[] stdout = proc.getInputStream().readAllBytes();
            if (!proc.waitFor(10, TimeUnit.SECONDS) || proc.exitValue() != 0) {
                log.warn("MiMo TTS ffmpeg 转换失败: {}", new String(stdout));
                return null;
            }

            File f = new File(outFile);
            if (!f.exists() || f.length() == 0) return null;
            return Files.readAllBytes(f.toPath());
        } catch (Exception e) {
            log.error("MiMo TTS ffmpeg 异常", e);
            return null;
        } finally {
            new File(rawFile).delete();
            new File(outFile).delete();
        }
    }

    /**
     * 合成结果
     */
    public record SynthResult(byte[] audio, long apiTimeMs, long ffmpegTimeMs, long totalTimeMs, int rawSize) {
    }
}
