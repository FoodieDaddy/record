package com.smartrecord.service.impl;

import com.smartrecord.dto.mirror.MbtiTestReq;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MBTI 20题简化版计算器
 * 四维度: E/I, S/N, T/F, J/P
 * 评分: score>0 表示偏向右侧字母, score<0 表示偏向左侧字母
 */
public class MbtiCalculator {

    private static final Map<String, String> TITLE_MAP = Map.ofEntries(
            Map.entry("INTJ", "冷静型控场者"), Map.entry("INTP", "模型型分析者"),
            Map.entry("ENTJ", "压迫型指挥者"), Map.entry("ENTP", "扰动型试探者"),
            Map.entry("INFJ", "远读型观察者"), Map.entry("INFP", "直觉型守序者"),
            Map.entry("ENFJ", "节奏型组织者"), Map.entry("ENFP", "机会型游走者"),
            Map.entry("ISTJ", "纪律型执行者"), Map.entry("ISFJ", "防守型稳定者"),
            Map.entry("ESTJ", "规则型压制者"), Map.entry("ESFJ", "协同型支援者"),
            Map.entry("ISTP", "冷启动猎手"),   Map.entry("ISFP", "低频型感知者"),
            Map.entry("ESTP", "高压型突击者"), Map.entry("ESFP", "现场型爆发者")
    );

    private static final List<String> ALL_TYPES = List.of(
            "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
            "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"
    );

    /**
     * 维度对：dimension key → [左侧字母, 右侧字母]
     */
    private static final Map<String, String[]> DIM_PAIRS = Map.of(
            "E_I", new String[]{"I", "E"},
            "S_N", new String[]{"S", "N"},
            "T_F", new String[]{"T", "F"},
            "J_P", new String[]{"J", "P"}
    );

    public static Result calculate(List<MbtiTestReq.Answer> answers) {
        // 统计每个维度的正负分
        Map<String, int[]> dims = new LinkedHashMap<>();
        dims.put("E_I", new int[]{0, 0});
        dims.put("S_N", new int[]{0, 0});
        dims.put("T_F", new int[]{0, 0});
        dims.put("J_P", new int[]{0, 0});

        for (var a : answers) {
            int[] d = dims.get(a.getDimension());
            if (d == null) continue;
            if (a.getScore() > 0) d[0]++;       // 偏右
            else if (a.getScore() < 0) d[1]++;  // 偏左
        }

        StringBuilder type = new StringBuilder();
        double totalConfidence = 0;

        for (var entry : dims.entrySet()) {
            String[] pair = DIM_PAIRS.get(entry.getKey());
            int[] d = entry.getValue();
            int leftCount = d[1];  // score<0 → 偏左
            int rightCount = d[0]; // score>0 → 偏右
            int total = leftCount + rightCount;

            if (total == 0) {
                type.append(pair[0]); // 默认选左
                totalConfidence += 50;
            } else if (rightCount >= leftCount) {
                type.append(pair[1]); // 偏右
                totalConfidence += (double) rightCount / total * 100;
            } else {
                type.append(pair[0]); // 偏左
                totalConfidence += (double) leftCount / total * 100;
            }
        }

        String mbtiType = type.toString();
        return new Result(mbtiType, TITLE_MAP.getOrDefault(mbtiType, "未知型"), totalConfidence / 4.0);
    }

    public static boolean isValidType(String type) {
        return type != null && ALL_TYPES.contains(type.toUpperCase());
    }

    public static String getTitle(String type) {
        return TITLE_MAP.getOrDefault(type != null ? type.toUpperCase() : "", "未知型");
    }

    public record Result(String type, String title, double confidence) {}
}
