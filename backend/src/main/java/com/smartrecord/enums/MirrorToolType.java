package com.smartrecord.enums;

import com.smartrecord.common.BizException;
import lombok.Getter;

@Getter
public enum MirrorToolType {

    // TODAY
    ALMANAC("almanac", "今日黄历", "TODAY", false, false, "今日宜忌与场域概览"),
    TAIYI("taiyi", "太乙九星", "TODAY", false, false, "太乙九星时空推演"),

    // QUICK
    TAROT("tarot", "塔罗抽牌", "QUICK", false, true, "探索潜意识与短期选择"),
    MEIHUA("meihua", "梅花易数", "QUICK", false, true, "随机事件与局势判断"),
    XIAOLIUREN("xiaoliuren", "小六壬", "QUICK", false, true, "今日行动与快速判断"),
    LIUYAO("liuyao", "六爻", "QUICK", false, true, "明确问题与趋势判断"),
    QIMEN("qimen", "奇门遁甲", "QUICK", false, true, "谈判合作与时机推演"),

    // PROFILE
    BAZI("bazi", "八字排盘", "PROFILE", true, false, "长期结构画像"),
    ZIWEI("ziwei", "紫微斗数", "PROFILE", true, false, "命盘宫位分析"),
    ASTROLOGY("astrology", "西方占星", "PROFILE", true, false, "三巨头与流运重点"),

    // ADVANCED
    BAZI_DAYUN("bazi_dayun", "八字大运", "ADVANCED", true, false, "十年周期与流年变化"),
    BAZI_PILLARS_RESOLVE("bazi_pillars_resolve", "八字反查", "ADVANCED", true, false, "天干地支反向查询"),
    ZIWEI_HOROSCOPE("ziwei_horoscope", "紫微运限", "ADVANCED", true, false, "大限小限与流年"),
    ZIWEI_FLYING_STAR("ziwei_flying_star", "紫微飞星", "ADVANCED", true, false, "四化落宫与三方四正"),
    DALIUREN("daliuren", "大六壬", "ADVANCED", true, false, "四课三传高级占测");

    private final String code;
    private final String displayName;
    private final String category;
    private final boolean requiresBirthProfile;
    private final boolean requiresQuestion;
    private final String description;

    MirrorToolType(String code, String displayName, String category,
                   boolean requiresBirthProfile, boolean requiresQuestion, String description) {
        this.code = code;
        this.displayName = displayName;
        this.category = category;
        this.requiresBirthProfile = requiresBirthProfile;
        this.requiresQuestion = requiresQuestion;
        this.description = description;
    }

    public static MirrorToolType fromCode(String code) {
        for (MirrorToolType t : values()) {
            if (t.code.equals(code)) return t;
        }
        throw new BizException("未知工具类型: " + code);
    }

    /** 判断 taibu 域名是否可用（astrology 依赖 Node.js CJS，GraalVM 不支持） */
    public boolean isTaibuAvailable() {
        return this != ASTROLOGY;
    }
}
