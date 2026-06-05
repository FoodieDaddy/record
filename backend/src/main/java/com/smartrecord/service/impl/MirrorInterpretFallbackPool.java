package com.smartrecord.service.impl;

import com.smartrecord.dto.mirror.MirrorInterpretation;
import com.smartrecord.dto.mirror.TaibuRunResult;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.enums.MirrorToolType;

import java.util.*;

/**
 * 兜底解释池 — 当 LLM 超时/失败/输出不合规时使用
 */
public class MirrorInterpretFallbackPool {

    private static final Map<MirrorToolType, List<MirrorInterpretation>> POOL = new EnumMap<>(MirrorToolType.class);

    static {
        POOL.put(MirrorToolType.TAROT, List.of(
                build("低频观察", "守势", "#0A84FF", "LOW",
                        "当前牌面仅适合作为低置信度参考。若局势信息不足，优先降低试探频率，保持结构稳定，不在情绪波动时做大决策。",
                        List.of("先观察三轮再行动", "减少连续试探频率"),
                        List.of("避免追损心态", "警惕情绪化决策")),
                build("静默潜伏", "蛰伏", "#5E5CE6", "LOW",
                        "当前能量场偏弱，适合旁观与复盘，不适合主动出击。让信息充分暴露后再做判断。",
                        List.of("保持低姿态观察", "记录对手行为模式"),
                        List.of("不宜频繁换策略", "避免高风险操作")),
                build("结构分析", "冷静", "#0A84FF", "LOW",
                        "当前局面信息不完整，牌面指向模糊。建议先收集更多信息，再做判断。",
                        List.of("建立观察清单", "等待信息明朗"),
                        List.of("不要凭直觉下注", "避免情绪化加注"))
        ));

        POOL.put(MirrorToolType.MEIHUA, List.of(
                build("时势未明", "观望", "#0A84FF", "LOW",
                        "卦象结构指向不明，互卦与变卦之间缺乏一致性。当前不适合做激进决策。",
                        List.of("等待下一周期信号", "保持当前节奏"),
                        List.of("避免冲动决策", "不宜扩大投入")),
                build("守中待变", "稳守", "#30D158", "LOW",
                        "本卦显示稳定态势，但变卦暗示潜在变化。保持现有结构，等待变量明朗。",
                        List.of("稳守当前阵地", "小幅试探边界"),
                        List.of("不宜大幅调整", "警惕隐性风险")),
                build("静水深流", "潜行", "#5E5CE6", "LOW",
                        "表面平静但暗流涌动。适合做小规模测试，不适合大规模投入。",
                        List.of("小规模试错验证", "保持退路畅通"),
                        List.of("不要孤注一掷", "避免追损加码"))
        ));

        POOL.put(MirrorToolType.XIAOLIUREN, List.of(
                build("宫位模糊", "低频", "#0A84FF", "LOW",
                        "当前宫位落点指向不明确，短期行动信号较弱。建议以观察为主。",
                        List.of("等待清晰信号", "记录当前态势"),
                        List.of("不宜主动出击", "避免连续操作")),
                build("留白", "静候", "#0A84FF", "LOW",
                        "小六壬落点显示当前时空气场偏弱，不适合做重大决策。",
                        List.of("休整与复盘", "等待气场回升"),
                        List.of("不宜高风险操作", "避免情绪波动"))
        ));

        POOL.put(MirrorToolType.LIUYAO, List.of(
                build("用神不明", "待定", "#0A84FF", "LOW",
                        "卦中用神不显，动爻指向模糊。当前信息不足以做出准确判断。",
                        List.of("重新明确问题", "等待更多线索"),
                        List.of("不宜盲目行动", "避免过度解读")),
                build("静卦", "守势", "#5E5CE6", "LOW",
                        "静卦显示当前局面稳定，变化不大。适合维持现状。",
                        List.of("保持当前策略", "小幅微调即可"),
                        List.of("不宜大幅变动", "避免激进操作"))
        ));

        POOL.put(MirrorToolType.QIMEN, List.of(
                build("格局未开", "蛰伏", "#0A84FF", "LOW",
                        "奇门格局显示当前时机未到，门星神宫位关系不明确。建议等待。",
                        List.of("等待最佳时机", "观察对手布局"),
                        List.of("不宜主动暴露", "避免正面冲突")),
                build("暗中布局", "潜伏", "#5E5CE6", "LOW",
                        "当前适合暗中布局，不适合正面出击。保持低调，积累优势。",
                        List.of("暗中准备方案", "收集关键情报"),
                        List.of("不宜过早亮牌", "避免打草惊蛇"))
        ));

        POOL.put(MirrorToolType.ALMANAC, List.of(
                build("平稳日", "巡航", "#0A84FF", "LOW",
                        "今日无明显波动信号，适合按部就班，正常发挥即可。",
                        List.of("保持日常节奏", "稳定输出"),
                        List.of("不宜激进操作", "避免冒险")),
                build("普通日", "常规", "#30D158", "LOW",
                        "今日能量平稳，无特殊宜忌。适合常规操作和复盘。",
                        List.of("按计划执行", "做好记录复盘"),
                        List.of("不宜临时变阵", "避免冲动"))
        ));

        POOL.put(MirrorToolType.TAIYI, List.of(
                build("九星平稳", "巡航", "#0A84FF", "LOW",
                        "太乙九星当前排列平稳，无明显吉凶指向。适合按节奏推进。",
                        List.of("保持稳定节奏", "关注细节变化"),
                        List.of("不宜大起大落", "避免情绪化")),
                build("能量低频", "静守", "#5E5CE6", "LOW",
                        "当前时空能量偏低，适合复盘和准备，不适合高强度对抗。",
                        List.of("低强度复盘", "调整状态储备"),
                        List.of("避免高强度对抗", "不宜连续作战"))
        ));

        POOL.put(MirrorToolType.BAZI, List.of(
                build("结构画像", "参考", "#0A84FF", "LOW",
                        "八字排盘结果仅作为长期结构参考，不涉及具体事件预测。每个人的选择仍然是决定性因素。",
                        List.of("了解自身特质", "发挥优势领域"),
                        List.of("不做命运判断", "避免宿命论"))
        ));

        POOL.put(MirrorToolType.ZIWEI, List.of(
                build("宫位参考", "分析", "#0A84FF", "LOW",
                        "紫微斗数宫位分析仅作为性格与倾向参考，具体行动仍取决于个人判断。",
                        List.of("了解宫位特质", "参考三方四正"),
                        List.of("不做寿命判断", "不做灾祸预测"))
        ));

        POOL.put(MirrorToolType.ASTROLOGY, List.of(
                build("星盘参考", "参考", "#0A84FF", "LOW",
                        "星盘分析仅作为人格特质参考，流运变化不等于命运注定。",
                        List.of("了解本命特质", "关注行运周期"),
                        List.of("不做疾病预测", "不做灾祸判断"))
        ));

        // 高级工具共用 fallback
        List<MirrorInterpretation> advancedFallback = List.of(
                build("高级推演", "参考", "#0A84FF", "LOW",
                        "高级推演结果仅作为长期结构参考，需要结合具体情境解读。不涉及具体事件预测。",
                        List.of("作为长期参考", "结合实际情况"),
                        List.of("不做绝对判断", "避免过度依赖")),
                build("趋势参考", "分析", "#5E5CE6", "LOW",
                        "推演结果指向不明确，建议作为辅助参考而非决策依据。",
                        List.of("多维度交叉验证", "保持独立判断"),
                        List.of("不宜单点决策", "避免盲目跟随"))
        );
        POOL.put(MirrorToolType.BAZI_DAYUN, advancedFallback);
        POOL.put(MirrorToolType.BAZI_PILLARS_RESOLVE, advancedFallback);
        POOL.put(MirrorToolType.ZIWEI_HOROSCOPE, advancedFallback);
        POOL.put(MirrorToolType.ZIWEI_FLYING_STAR, advancedFallback);
        POOL.put(MirrorToolType.DALIUREN, advancedFallback);
    }

    /**
     * 获取兜底解释
     */
    public static MirrorInterpretation fallback(MirrorToolType toolType, UserMirrorProfile profile, TaibuRunResult result) {
        List<MirrorInterpretation> pool = POOL.getOrDefault(toolType, POOL.get(MirrorToolType.ALMANAC));
        return pool.get(new Random().nextInt(pool.size()));
    }

    private static MirrorInterpretation build(String title, String tag, String themeColor, String confidence,
                                               String summary, List<String> suggestions, List<String> warnings) {
        return MirrorInterpretation.builder()
                .title(title)
                .tag(tag)
                .themeColor(themeColor)
                .confidence(confidence)
                .summary(summary)
                .suggestions(suggestions)
                .warnings(warnings)
                .build();
    }
}
