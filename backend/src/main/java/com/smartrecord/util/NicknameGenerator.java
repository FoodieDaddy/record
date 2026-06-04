package com.smartrecord.util;

import java.util.concurrent.ThreadLocalRandom;

/**
 * 麻将主题昵称生成器（≤6 字符版）
 * 所有组合严格控制在 6 个字符以内
 */
public class NicknameGenerator {

    /** 1~2 字符前缀 */
    private static final String[] PREFIX = {
        "雀神","雀圣","雀帝","雀王","雀仙","雀侠",
        "胡了","杠王","听牌","自摸","天胡","地胡",
        "满贯","红中","发财","白板","东风","西风","南风","北风",
        "一筒","九筒","一条","九条","一万","九万",
        "清龙","混龙","花蝶","牌王"
    };

    /** 2~3 字符名字 */
    private static final String[] NAME = {
        "东方","西门","令狐","任盈","黄蓉","郭靖",
        "杨过","小龙","张飞","赵云","关羽","吕布",
        "乔峰","段誉","虚竹","韦小","洪七","黄药",
        "楚香","陆凤","李欢","花楼","叶城","燕天",
        "诸葛","曹操","刘备","孙权","周瑜",
        "悟空","八戒","哪吒","杨戬","子牙",
        "红雪","鱼儿","无缺","浪子","剑客"
    };

    /** 1~2 字符后缀（仅搭配 2 字符 PREFIX + 2 字符 NAME 时使用） */
    private static final String[] SUFFIX = {
        "本尊","大人","驾到","在此","出山","归来"
    };

    public static String generate() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        String prefix = PREFIX[r.nextInt(PREFIX.length)];
        String name = NAME[r.nextInt(NAME.length)];

        double mode = r.nextDouble();
        if (mode < 0.5) {
            // prefix + name → 2+2=4, 2+3=5
            return prefix + name;
        } else if (mode < 0.75) {
            // prefix + name + 数字 → 最多 2+3+1=6
            return prefix + name + (r.nextInt(9) + 1);
        } else if (prefix.length() == 2 && name.length() == 2) {
            // prefix + name + suffix → 2+2+2=6（仅当总长 ≤6 时）
            return prefix + name + SUFFIX[r.nextInt(SUFFIX.length)];
        } else {
            // fallback: prefix + name + 数字
            return prefix + name + (r.nextInt(9) + 1);
        }
    }
}
