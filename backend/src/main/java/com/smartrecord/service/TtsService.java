package com.smartrecord.service;

import com.alibaba.csp.sentinel.annotation.SentinelResource;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Edge TTS 语音合成 — 调用 edge-tts CLI 生成 MP3，再用 ffmpeg 转为标准格式
 */
@Slf4j
@Service
public class TtsService {

    @Value("${tts.edge-tts-cmd:edge-tts}")
    private String edgeTtsCmd;

    @Value("${tts.voice:zh-CN-YunyangNeural}")
    private String voice;

    /**
     * 合成语音，返回 MP3 字节数组（标准 44.1kHz 128kbps 格式）
     */
    @SentinelResource(value = "tts-synthesize",
            blockHandler = "synthesizeBlockHandler",
            fallback = "synthesizeFallback")
    public byte[] synthesize(String text, String voiceOverride, String rate, String pitch) {
        String activeVoice = (voiceOverride != null && !voiceOverride.isBlank()) ? voiceOverride : voice;
        return doSynthesize(text, activeVoice, rate, pitch);
    }

    /**
     * 合成语音（带计时），用于 benchmark 对比
     */
    public SynthResult synthesizeWithTiming(String text, String voiceOverride, String rate, String pitch) {
        String activeVoice = (voiceOverride != null && !voiceOverride.isBlank()) ? voiceOverride : voice;
        return doSynthesizeWithTiming(text, activeVoice, rate, pitch);
    }

    /**
     * Sentinel 限流降级 — TTS 合成
     */
    public byte[] synthesizeBlockHandler(String text, String voiceOverride, String rate, String pitch, BlockException ex) {
        log.warn("TTS 合成被限流: {}", ex.getRule());
        return null;
    }

    public byte[] synthesizeFallback(String text, String voiceOverride, String rate, String pitch, Throwable ex) {
        log.error("TTS 合成降级", ex);
        return null;
    }

    public record SynthResult(byte[] audio, long edgeTtsMs, long ffmpegMs, long totalTimeMs) {}

    private SynthResult doSynthesizeWithTiming(String text, String activeVoice, String rate, String pitch) {
        String sanitized = text.replaceAll("[^\\u4e00-\\u9fa5a-zA-Z0-9\\s,\\.!?;:()\\-+*/=]", "");
        if (sanitized.isBlank()) return new SynthResult(null, 0, 0, 0);

        String id = UUID.randomUUID().toString();
        String tmpDir = System.getProperty("java.io.tmpdir");
        String rawFile = tmpDir + "/tts_raw_" + id + ".mp3";
        String outFile = tmpDir + "/tts_out_" + id + ".mp3";

        try {
            // 1. edge-tts
            long t0 = System.currentTimeMillis();
            var cmd = new java.util.ArrayList<String>();
            cmd.add(edgeTtsCmd);
            cmd.add("--voice");
            cmd.add(activeVoice);
            cmd.add("--text");
            cmd.add(sanitized);
            cmd.add("--write-media");
            cmd.add(rawFile);
            if (rate != null && !rate.isBlank()) cmd.add("--rate=" + rate);
            if (pitch != null && !pitch.isBlank()) cmd.add("--pitch=" + pitch);

            ProcessBuilder pb1 = new ProcessBuilder(cmd);
            pb1.redirectErrorStream(true);
            Process proc1 = pb1.start();
            byte[] stdout1 = proc1.getInputStream().readAllBytes();
            if (!proc1.waitFor(10, TimeUnit.SECONDS) || proc1.exitValue() != 0) {
                log.warn("edge-tts 失败: {}", new String(stdout1));
                return new SynthResult(null, System.currentTimeMillis() - t0, 0, System.currentTimeMillis() - t0);
            }
            long t1 = System.currentTimeMillis();

            // 2. ffmpeg
            ProcessBuilder pb2 = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", rawFile,
                    "-ar", "44100", "-ab", "128k", "-ac", "1", "-f", "mp3",
                    outFile
            );
            pb2.redirectErrorStream(true);
            Process proc2 = pb2.start();
            byte[] stdout2 = proc2.getInputStream().readAllBytes();
            if (!proc2.waitFor(10, TimeUnit.SECONDS) || proc2.exitValue() != 0) {
                log.warn("ffmpeg 转换失败: {}", new String(stdout2));
                return new SynthResult(null, t1 - t0, System.currentTimeMillis() - t1, System.currentTimeMillis() - t0);
            }
            long t2 = System.currentTimeMillis();

            File f = new File(outFile);
            if (!f.exists() || f.length() == 0) return new SynthResult(null, t1 - t0, t2 - t1, t2 - t0);
            byte[] audio = Files.readAllBytes(f.toPath());
            return new SynthResult(audio, t1 - t0, t2 - t1, t2 - t0);

        } catch (Exception e) {
            log.error("TTS 合成异常", e);
            return new SynthResult(null, 0, 0, 0);
        } finally {
            new File(rawFile).delete();
            new File(outFile).delete();
        }
    }

    private byte[] doSynthesize(String text, String activeVoice, String rate, String pitch) {
        // 输入白名单过滤：仅允许中文、字母、数字、常见标点和空格
        String sanitized = text.replaceAll("[^\\u4e00-\\u9fa5a-zA-Z0-9\\s,\\.!?;:()\\-+*/=]", "");
        if (sanitized.isBlank()) return null;

        String id = UUID.randomUUID().toString();
        String tmpDir = System.getProperty("java.io.tmpdir");
        String rawFile = tmpDir + "/tts_raw_" + id + ".mp3";
        String outFile = tmpDir + "/tts_out_" + id + ".mp3";

        try {
            // 1. edge-tts 生成原始音频
            var cmd = new java.util.ArrayList<String>();
            cmd.add(edgeTtsCmd);
            cmd.add("--voice");
            cmd.add(activeVoice);
            cmd.add("--text");
            cmd.add(sanitized);
            cmd.add("--write-media");
            cmd.add(rawFile);
            if (rate != null && !rate.isBlank()) {
                cmd.add("--rate=" + rate);
            }
            if (pitch != null && !pitch.isBlank()) {
                cmd.add("--pitch=" + pitch);
            }
            ProcessBuilder pb1 = new ProcessBuilder(cmd);
            pb1.redirectErrorStream(true);
            Process proc1 = pb1.start();
            byte[] stdout1 = proc1.getInputStream().readAllBytes();
            if (!proc1.waitFor(10, TimeUnit.SECONDS) || proc1.exitValue() != 0) {
                log.warn("edge-tts 失败: {}", new String(stdout1));
                return null;
            }

            // 2. ffmpeg 转换为标准 MP3（微信 InnerAudioContext 兼容）
            ProcessBuilder pb2 = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", rawFile,
                    "-ar", "44100", "-ab", "128k", "-ac", "1", "-f", "mp3",
                    outFile
            );
            pb2.redirectErrorStream(true);
            Process proc2 = pb2.start();
            byte[] stdout2 = proc2.getInputStream().readAllBytes();
            if (!proc2.waitFor(10, TimeUnit.SECONDS) || proc2.exitValue() != 0) {
                log.warn("ffmpeg 转换失败: {}", new String(stdout2));
                return null;
            }

            // 3. 读取转换后的文件
            File f = new File(outFile);
            if (!f.exists() || f.length() == 0) {
                log.warn("转换后文件为空");
                return null;
            }
            byte[] audio = Files.readAllBytes(f.toPath());
            return audio;

        } catch (Exception e) {
            log.error("TTS 合成异常", e);
            return null;
        } finally {
            new File(rawFile).delete();
            new File(outFile).delete();
        }
    }
}
