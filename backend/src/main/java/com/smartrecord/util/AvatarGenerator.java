package com.smartrecord.util;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.ObjectMetadata;
import com.smartrecord.config.OssConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 基于 vue-color-avatar SVG 素材的卡通头像生成器
 * 用昵称做 seed，确定性随机选择各部件，拼接 SVG 上传 OSS
 */
@Slf4j
@Component
public class AvatarGenerator {

    private final OSS ossClient;
    private final OssConfig ossConfig;

    /** widgetType → (shapeName → svgInnerContent) */
    private final Map<String, Map<String, String>> widgetCache = new HashMap<>();

    // ── 颜色配置（来自 vue-color-avatar SETTINGS） ──
    private static final String[] COMMON_COLORS = {
        "#6BD9E9", "#FC909F", "#F4D150", "#E0DDFF", "#D2EFF3",
        "#FFEDEF", "#FFEBA4", "#506AF4", "#F48150", "#48A99A",
        "#C09FFF", "#FD6F5D"
    };

    private static final String[] SKIN_COLORS = {
        "#F8D9CE", "#F9C9B6", "#DEB3A3", "#C89583", "#9C6458"
    };

    private static final String[] BG_COLORS = {
        "#6BD9E9", "#FC909F", "#F4D150", "#E0DDFF", "#D2EFF3",
        "#FFEDEF", "#FFEBA4", "#506AF4", "#F48150", "#48A99A",
        "#C09FFF", "#FD6F5D",
        "url(#bg-grad-1)", "url(#bg-grad-2)", "url(#bg-grad-3)",
        "url(#bg-grad-4)", "url(#bg-grad-5)"
    };

    private static final String[][] BG_GRADIENTS = {
        {"45deg", "#E3648C", "#D97567"},
        {"62deg", "#8EC5FC", "#E0C3FC"},
        {"90deg", "#ffecd2", "#fcb69f"},
        {"120deg", "#a1c4fd", "#c2e9fb"},
        {"-135deg", "#fccb90", "#d57eeb"}
    };

    // ── 部件配置 ──
    private static final String[] FACE_SHAPES = {"base"};
    private static final String[] EAR_SHAPES = {"attached", "detached"};
    private static final String[] EYES_SHAPES = {"ellipse", "eyeshadow", "round", "smiling"};
    private static final String[] EYEBROWS_SHAPES = {"up", "down", "eyelashesup", "eyelashesdown"};
    private static final String[] NOSE_SHAPES = {"curve", "pointed", "round"};
    private static final String[] MOUTH_SHAPES = {"frown", "laughing", "nervous", "pucker", "sad", "smile", "smirk", "surprised"};
    private static final String[] TOPS_SHAPES = {"beanie", "clean", "danny", "fonze", "funny", "pixie", "punk", "turban", "wave"};
    private static final String[] CLOTHES_SHAPES = {"crew", "collared", "open"};
    private static final String[] GLASSES_SHAPES = {"round", "square"};
    private static final String[] EARRINGS_SHAPES = {"hoop", "stud"};
    private static final String[] BEARD_SHAPES = {"scruff"};

    // ── zIndex 排序（来自 vue-color-avatar AVATAR_LAYER） ──
    private static final Map<String, Integer> Z_INDEX = Map.ofEntries(
        Map.entry("face", 10),
        Map.entry("ear", 102),
        Map.entry("earrings", 103),
        Map.entry("eyebrows", 70),
        Map.entry("eyes", 50),
        Map.entry("nose", 60),
        Map.entry("glasses", 90),
        Map.entry("mouth", 100),
        Map.entry("beard", 105),
        Map.entry("tops", 80),
        Map.entry("clothes", 110)
    );

    public AvatarGenerator(OSS ossClient, OssConfig ossConfig) {
        this.ossClient = ossClient;
        this.ossConfig = ossConfig;
    }

    @PostConstruct
    public void init() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            String[] types = {"face", "ear", "eyes", "eyebrows", "nose", "mouth", "tops", "clothes", "glasses", "earrings", "beard"};

            for (String type : types) {
                Map<String, String> shapeMap = new HashMap<>();
                Resource[] resources = resolver.getResources("classpath:avatars/" + type + "/*.svg");
                for (Resource res : resources) {
                    String filename = res.getFilename();
                    if (filename == null) continue;
                    String shapeName = filename.replace(".svg", "");
                    String content = new String(res.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                    shapeMap.put(shapeName, extractSvgInner(content));
                }
                widgetCache.put(type, shapeMap);
            }
            log.info("头像 SVG 模板加载完成, 共 {} 个部件类型", widgetCache.size());
        } catch (Exception e) {
            log.error("加载头像 SVG 模板失败", e);
        }
    }

    /**
     * 生成随机卡通头像 SVG 并上传 OSS，返回 objectKey
     */
    public String generateAndUpload() {
        String svg = composeSvg();
        String objectKey = "images/avatar-" + System.currentTimeMillis() + ThreadLocalRandom.current().nextInt(1000, 9999) + ".svg";

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType("image/svg+xml");
        metadata.setContentLength(svg.getBytes(StandardCharsets.UTF_8).length);

        ossClient.putObject(ossConfig.getBucketName(), objectKey,
                new ByteArrayInputStream(svg.getBytes(StandardCharsets.UTF_8)), metadata);

        return objectKey;
    }

    /**
     * 随机拼接完整 SVG
     */
    String composeSvg() {
        ThreadLocalRandom rng = ThreadLocalRandom.current();

        // 选择各部件
        Map<String, WidgetChoice> widgets = new LinkedHashMap<>();
        String skinColor = pick(rng, SKIN_COLORS);
        String hairColor = pick(rng, COMMON_COLORS);
        String clothesColor = pick(rng, COMMON_COLORS);

        widgets.put("face", new WidgetChoice(pick(rng, FACE_SHAPES), skinColor));
        widgets.put("ear", new WidgetChoice(pick(rng, EAR_SHAPES), null));
        widgets.put("earrings", maybePick(rng, EARRINGS_SHAPES));
        widgets.put("eyebrows", new WidgetChoice(pick(rng, EYEBROWS_SHAPES), null));
        widgets.put("eyes", new WidgetChoice(pick(rng, EYES_SHAPES), null));
        widgets.put("nose", new WidgetChoice(pick(rng, NOSE_SHAPES), null));
        widgets.put("glasses", maybePick(rng, GLASSES_SHAPES));
        widgets.put("mouth", new WidgetChoice(pick(rng, MOUTH_SHAPES), null));
        widgets.put("beard", maybePick(rng, BEARD_SHAPES));
        widgets.put("tops", new WidgetChoice(pick(rng, TOPS_SHAPES), hairColor));
        widgets.put("clothes", new WidgetChoice(pick(rng, CLOTHES_SHAPES), clothesColor));

        // 背景色
        String bgColor = pick(rng, BG_COLORS);
        String borderColor = pick(rng, COMMON_COLORS);

        // 按 zIndex 排序
        List<Map.Entry<String, WidgetChoice>> sorted = new ArrayList<>(widgets.entrySet());
        sorted.sort(Comparator.comparingInt(e -> Z_INDEX.getOrDefault(e.getKey(), 0)));

        // 拼接各部件 SVG 内容
        StringBuilder parts = new StringBuilder();
        for (Map.Entry<String, WidgetChoice> entry : sorted) {
            WidgetChoice wc = entry.getValue();
            if (wc == null || "none".equals(wc.shape)) continue;

            Map<String, String> shapeMap = widgetCache.get(entry.getKey());
            if (shapeMap == null || !shapeMap.containsKey(wc.shape)) continue;

            String inner = shapeMap.get(wc.shape);
            if (wc.fillColor != null) {
                inner = inner.replace("$fillColor", wc.fillColor);
            } else {
                inner = inner.replace("$fillColor", "transparent");
            }

            parts.append(String.format("<g id=\"avatar-%s\">%s</g>%n", entry.getKey(), inner));
        }

        // 渐变定义
        StringBuilder defs = new StringBuilder("<defs>");
        for (int i = 0; i < BG_GRADIENTS.length; i++) {
            String[] g = BG_GRADIENTS[i];
            defs.append(String.format(
                "<linearGradient id=\"bg-grad-%d\" x1=\"0%%\" y1=\"0%%\" x2=\"100%%\" y2=\"100%%\">",
                i + 1));
            defs.append(String.format("<stop offset=\"0%%\" stop-color=\"%s\"/>", g[1]));
            defs.append(String.format("<stop offset=\"100%%\" stop-color=\"%s\"/>", g[2]));
            defs.append("</linearGradient>");
        }
        defs.append("</defs>");

        // 背景矩形
        String bgFill = bgColor.startsWith("url(") ? bgColor : bgColor;
        String bgRect = String.format("<rect width=\"400\" height=\"400\" fill=\"%s\" rx=\"20\"/>", bgFill);

        // 边框
        String borderRect = String.format(
            "<rect width=\"400\" height=\"400\" fill=\"none\" stroke=\"%s\" stroke-width=\"4\" rx=\"20\"/>",
            borderColor);

        return String.format("""
            <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            %s
            %s
            <g transform="translate(100, 65)">
            %s
            </g>
            %s
            </svg>
            """, defs, bgRect, parts, borderRect);
    }

    /**
     * 从 SVG 字符串中提取 <svg> 标签内的内容
     */
    private String extractSvgInner(String svgRaw) {
        int start = svgRaw.indexOf('>', svgRaw.indexOf("<svg"));
        int end = svgRaw.lastIndexOf("</svg>");
        if (start < 0 || end < 0) return svgRaw;
        return svgRaw.substring(start + 1, end);
    }

    private String pick(Random rng, String[] arr) {
        return arr[rng.nextInt(arr.length)];
    }

    /**
     * 有概率返回 null（表示 none）
     */
    private WidgetChoice maybePick(Random rng, String[] arr) {
        if (rng.nextInt(3) == 0) return null; // 1/3 概率不选
        return new WidgetChoice(pick(rng, arr), null);
    }

    private record WidgetChoice(String shape, String fillColor) {}
}
