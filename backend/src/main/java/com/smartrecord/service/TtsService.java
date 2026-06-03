package com.smartrecord.service;

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

    @Value("${tts.voice:zh-CN-XiaoxiaoNeural}")
    private String voice;

    /**
     * 合成语音，返回 MP3 字节数组（标准 44.1kHz 128kbps 格式）
     */
    public byte[] synthesize(String text, String voiceOverride) {
        String activeVoice = (voiceOverride != null && !voiceOverride.isBlank()) ? voiceOverride : voice;
        return doSynthesize(text, activeVoice);
    }

    private byte[] doSynthesize(String text, String activeVoice) {
        String id = UUID.randomUUID().toString();
        String tmpDir = System.getProperty("java.io.tmpdir");
        String rawFile = tmpDir + "/tts_raw_" + id + ".mp3";
        String outFile = tmpDir + "/tts_out_" + id + ".mp3";

        try {
            // 1. edge-tts 生成原始音频
            ProcessBuilder pb1 = new ProcessBuilder(
                    edgeTtsCmd,
                    "--voice", activeVoice,
                    "--text", text,
                    "--write-media", rawFile
            );
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
