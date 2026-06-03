package com.smartrecord.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;

/**
 * 音色目录服务 — 从 voices.json 加载音色分类数据
 */
@Slf4j
@Service
public class VoiceCatalogService {

    private JsonNode catalog;

    @PostConstruct
    public void init() {
        try (InputStream is = new ClassPathResource("voices.json").getInputStream()) {
            catalog = new ObjectMapper().readTree(is);
            log.info("音色目录加载完成，共 {} 个分类",
                    catalog.path("categories").size());
        } catch (Exception e) {
            log.error("加载 voices.json 失败", e);
        }
    }

    /**
     * 获取完整音色目录（含分类）
     */
    public JsonNode getCatalog() {
        return catalog;
    }

    /**
     * 按 ID 查找音色，返回 { voice, rate, pitch } 或 null
     */
    public JsonNode findVoiceById(String voiceId) {
        if (catalog == null || voiceId == null) return null;
        for (JsonNode category : catalog.path("categories")) {
            for (JsonNode v : category.path("voices")) {
                if (voiceId.equals(v.path("id").asText())) {
                    return v;
                }
            }
        }
        return null;
    }
}
