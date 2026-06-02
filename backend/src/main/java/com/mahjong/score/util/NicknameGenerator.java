package com.mahjong.score.util;

import java.util.concurrent.ThreadLocalRandom;

/**
 * 麻将/扑克主题昵称生成器
 * 组合方式: prefix × name → 10000+ 种
 */
public class NicknameGenerator {

    private static final String[] PREFIX = {
        "雀神","雀圣","雀帝","雀王","雀仙","雀侠","雀狂","雀魔",
        "九莲宝灯","十三幺","天胡","地胡","清一色","混一色",
        "大三元","小三元","大四喜","小四喜","绿一色","字一色",
        "四暗刻","三暗刻","百万石","红中","发财","白板",
        "东风","西风","南风","北风","一筒","九筒","一条","九条","一万","九万",
        "杠上开花","海底捞月","妙手回春","绝张","自摸","点炮",
        "听牌","诈胡","天听","门前清","不求人","全求人",
        "断幺","平和","七对子","混幺九","宝牌",
        "皇家同花顺","同花顺","四条","葫芦","同花","顺子",
        "黑桃","红桃","梅花","方块","梭哈","全押",
        "一条龙","满贯","役满"
    };

    private static final String[] NAME = {
        "东方不败","西门吹雪","令狐冲","任盈盈","黄蓉","郭靖",
        "杨过","小龙女","张无忌","赵敏","周芷若","乔峰",
        "段誉","虚竹","韦小宝","洪七公","黄药师","王重阳",
        "独孤求败","风清扬","岳不群","左冷禅","张三丰",
        "楚留香","陆小凤","李寻欢","花满楼","叶孤城",
        "傅红雪","小鱼儿","花无缺","燕南天","沈浪",
        "诸葛亮","曹操","关羽","张飞","赵云","吕布",
        "貂蝉","周瑜","司马懿","孙悟空","猪八戒",
        "哪吒","杨戬","姜子牙","金轮法王","李莫愁",
        "谢逊","灭绝师太","定逸师太","冲虚道长","方证大师"
    };

    private static final String[] SUFFIX = {
        "本尊","大人","驾到","在此","出山","归来","再战","降临"
    };

    public static String generate() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        String prefix = PREFIX[r.nextInt(PREFIX.length)];
        String name = NAME[r.nextInt(NAME.length)];

        double mode = r.nextDouble();
        if (mode < 0.5) {
            // prefix + name
            return prefix + name;
        } else if (mode < 0.75) {
            // prefix + name + suffix
            return prefix + name + SUFFIX[r.nextInt(SUFFIX.length)];
        } else {
            // prefix + name + 数字
            return prefix + name + (r.nextInt(999) + 1);
        }
    }
}
