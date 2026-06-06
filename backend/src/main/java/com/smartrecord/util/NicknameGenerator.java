package com.smartrecord.util;

import lombok.Getter;

import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 记分场景昵称生成器（≤6 字符版）
 * 所有组合严格控制在 6 个字符以内
 */
public class NicknameGenerator {

    /** 2 字符前置修饰语 */
    private static final String[] ADJ2 = {
            // -- 原有 --
            "先天", "后天", "被迫", "国服", "村级", "野生", "退役", "电竞", "单身",
            "纯爱", "硬汉", "嘴强", "卑微", "熬夜",
            // -- 扩充 --
            "佛系", "暴躁", "迷之", "究极", "资深", "业余", "纯血", "满级", "见习",
            "硬核", "躺平", "摆烂", "顶级", "边缘", "宝藏", "塑料", "虚假", "高配",
            "低配", "特级", "无情", "发福", "贫穷", "秃头", "过气", "过劳"
    };

    /** 3 字符前置修饰语 */
    private static final String[] ADJ3 = {
            // -- 原有 --
            "尊贵的", "嘴硬的", "深情的", "破防的", "摆烂的", "纯正的", "离谱的",
            "致命的",  "绝望的", "迷人的", "下饭的", "硬核的", "抽象的",
            "送分的", "全自动",
            // -- 扩充 --
            "倒霉的", "暴躁的", "划水的", "漏风的", "贫穷的", "倔强的", "迷茫的",
            "快乐的", "掉线的", "懂事的", "半自动", "纯手工",  "传说中",
            "高压的", "开挂的", "护肝的", "刮痧的", "白给的", "超凡的", "隐形的",
            "贪婪的","无敌的","呆呆的","疯癫的","搞笑的","纠结的","沉默的","优秀的"
    };

    /** 4 字符名词/状态/成语（主打一个人设） */
    private static final String[] NOUN4 = {
            // -- 原有 --
            "无心无爱", "人菜瘾大", "欧气满满", "佛系复盘", "顶级折磨",
            "欧皇降临", "带刀侍卫",
            "炸弹狂魔",
            // -- 扩充 --
            "屡战屡败", "屡败屡战", "阳光开朗", "阴暗爬行", "血压飙升",
            "漏网之鱼", "黄金矿工", "在逃公主","天选之子","摸鱼大师","星轨巡游","仪表校准","非酋附体",
            "精神小伙", "纯爱战神", "嘴强王者","声纳回响",
            "节奏大师", "全村希望", "闭眼玩家", "键盘车神", "泉水指挥", "毫无波澜",
            "重在参与", "越塔送人", "反向冲刺", "理直气壮",
    };

    /** 5~6 字符长前缀/长状态 */
    private static final String[] NOUN5_6 = {
            // -- 原有 --
            "星港调度员",
            // -- 扩充 --
            "顶级折磨王", "穿梭机长", "宇宙倒霉蛋", "纯血非酋长", "资深大冤种",
            "摸鱼天花板", "毫无参与感", "资深划水员", "局外观察员", "跨域通信员",
            "随时会掉线", "舰桥播报员", "被迫营业的",
    };

    /** 1~2 字符称呼/头衔 */
    private static final String[] NAME2 = {
            "舵手", "领航", "舰桥", "星港", "通信",
            "杠精", "内鬼", "卧底", "狼人", "地主", "农民", "舔狗", "吗喽",
            "老六", "棋王", "棋圣", "护盾", "脉冲","懂王", "卷王",
            "萌新", "大神", "菜鸟", "咸鱼", "锦鲤", "混子", "演员",
            "欧皇", "非酋", "散人",  "航电", "引擎",
            "大腿", "挂件", "宝宝", "仙女", "少爷",
            // ---- 动物系/打工人热梗 ----
            "牛马", "貔貅", "水豚", "帕鲁", "憨憨",
            "狗子", "鸽子", "铁公鸡",
            // ---- 实力与层级（褒贬都有） ----
            "大佬", "巨佬", "坑货", "腿毛", "战神",
            "宗师", "王者", "青铜", "霸主", "炮灰",
            // ---- 竞技/协作人设 ----
            "星轨",  "牌搭", "听客", "军师",
            "卧龙", "凤雏", "判官",
            "保镖", "辅助", "替补", "队长",
            // ---- 性格与抽象网感 ----
            "怨种", "戏精", "秀儿", "霸总", "毒奶",
            "铁壁", "盲盒", "挂哥", "话痨", "社恐",
            "社牛", "海王", "直男", "作精", "黑粉"
    };

    /** 3 字符称呼/头衔 */
    private static final String[] NAME3 = {
            "大聪明", "老司机", "穷光蛋", "破产者", "守财奴", "扫描员", "大魔王",
            "绝活哥", "天谴者", "伏地魔", "气氛组", "乐子人", "小黑子", "显眼包",
            "大怨种", "练习生", "打工人",
            "经验包", "提款机", "铁头娃", "糊涂虫", "倒霉蛋", "瞌睡虫", "鸽子王",
            "划水王", "捡漏王", "工具人", "冲浪王", "键盘侠",  "熬夜党",
            "背锅侠", "端水师", "老戏骨", "透明人", "复读机", "干饭人", "大冤种",
        // ---- 对局行为类（非常适合记分场景） ----
        "记录官", "吞金兽", "铁公鸡", "细节怪", "护航员",
        "监听者", "守门员", "破坏王", "终结者", "星航员",
        "莽夫党", "细节控", "马后炮", "老油条", "常胜军",

        // ---- 网络热门人设/性格类 ----
        "谜语人", "柠檬精", "嘤嘤怪", "玻璃心", "墙头草",
        "懂事长", "卷心菜", "乐天派", "恋爱脑", "单身狗",
        "嘴替侠", "和事佬", "出气筒", "万事通", "心机怪",

        // ---- 状态与生活梗 ----
        "摸鱼王", "强迫症", "拖延症", "假粉丝", "真爱粉",
        "主理人", "主心骨", "吃瓜党", "颜控党", "早八人",
        "踩雷王", "避雷针", "老玩家"
    };


    /** 1~2 字符动作/结尾词 */
    private static final String[] SUFFIX2 = {
            "本尊", "大人", "驾到", "在此", "出山", "归来",
            "启动", "上号", "下班", "真香", "急了", "请战", "护体",
            "登场", "落泪", "撤退", "躺平", "挂机", "认输", "叹气", "邀功", "挨打",
            "报到", "发愁", "围观", "迷路", "发呆", "吃瓜", "挠头"
    };

    /** 3 字符动作/结尾词 */
    private static final String[] SUFFIX3 = {
            "退退退", "求放过", "已破防", "绝绝子",
            "没赢过", "求带飞", "破防了", "没输过",
            // -- 扩充 --
            "搞快点", "睡着了", "掉线了", "太难了", "起飞了", "着陆了",
            "带不动", "别催了", "尽力了", "在发呆", "不想玩", "躺好了", "又挂了",
            "快救我", "卡住了", "算了吧"
    };

    /** 4 字符动作/结尾词 */
    private static final String[] SUFFIX4 = {
            // -- 原有 --
            "申请出战", "不请自来", "YYDS", "正在破防", "请求出战",
            // -- 扩充 --
            "骂骂咧咧", "疯狂掉线", "原地爆炸", "怀疑人生", "瑟瑟发抖", "随时跑路",
            "重拳出击", "唯唯诺诺", "稳定发挥", "持续高压", "汗流浃背", "正在输入",
            "拒绝沟通", "骂骂咧咧", "反向操作", "安详闭眼", "已就位"
    };

    private static final Random RANDOM = new Random();

    // 辅助方法：从数组中随机抽一个词
    private static String pick(String[] array) {
        return array[RANDOM.nextInt(array.length)];
    }

    /**
     * 核心算法：按权重随机选择一个组合模板
     */
    private static NameTemplateEnum getRandomTemplate() {
        // 1. 计算所有组合的权重总和
        int totalWeight = 0;
        for (NameTemplateEnum template : NameTemplateEnum.values()) {
            totalWeight += template.getWeight();
        }

        // 2. 在 [0, totalWeight) 范围内生成一个随机数
        // 比如总权重是 85，就生成一个 0~84 的随机数
        int randomHit = RANDOM.nextInt(totalWeight);

        // 3. 遍历轮盘，累加权重，看指针落在哪一块
        int currentWeight = 0;
        for (NameTemplateEnum template : NameTemplateEnum.values()) {
            currentWeight += template.getWeight();
            // 如果随机数小于当前累加的边界，说明命中了这一块！
            if (randomHit < currentWeight) {
                return template;
            }
        }

        // 兜底返回（正常逻辑不会走到这里）
        return NameTemplateEnum.values()[0];
    }
    /**
     * 对外暴露的生成名字的入口
     */
    public static String generateRandomName() {
        // 1. 按权重抽中一个模板
        NameTemplateEnum template = getRandomTemplate();
        // 2. 执行该模板的拼接逻辑
        return template.generate();
    }
    public static void main(String[] args) {
        // 模拟生成 10 个名字看分布效果
        String s = "";

        for (int i = 0; i < 200; i++) {
            String name = generateRandomName();
            if (i % 10 != 0)
                s += name + "\t";
            else {
                System.out.println(s);
                s = "";
            }

        }
    }

    @Getter
    public enum NameTemplateEnum{
        ADJ2_NAME2(5) {
            public String generate() {
                return pick(ADJ2) + pick(NAME2); // 比如：野生打工人
            }
        },
        ADJ2_NAME3(5) {
            public String generate() {
                return pick(ADJ2) + pick(NAME3); // 比如：超级大jury
            }
        },
        ADJ3_NAME2(5) {
            public String generate() {
                return pick(ADJ3) + pick(NAME2); // 比如：超级大jury
            }
        },
        ADJ3_NAME3(5) {
            public String generate() {
                return pick(ADJ3) + pick(NAME3); // 比如：超级大jury
            }
        },
        NAME2_SUFFIX2(5) {
            public String generate() {
                return pick(NAME2) + pick(SUFFIX2); // 比如：大jury
            }
        },
        NAME2_SUFFIX3(5) {
            public String generate() {
                return pick(NAME2) + pick(SUFFIX3); // 比如：大jury
            }
        },
        NAME2_SUFFIX4(5) {
            public String generate() {
                return pick(NAME2) + pick(SUFFIX4); // 比如：大jury
            }
        },
        NAME3_SUFFIX2(5) {
            public String generate() {
                return pick(NAME3) + pick(SUFFIX2); // 比如：超级大jury
            }
        },
        NAME3_SUFFIX3(5) {
            public String generate() {
                return pick(NAME3) + pick(SUFFIX3); // 比如：超级大jury
            }
        },
        NAME2_(2){
            public String generate() {
                return pick(NAME2); // 比如：超级大jury
            }
        },
        NAME3_(5){
            public String generate() {
                return pick(NAME3); // 比如：超级大jury
            }
        },
        NOUN4_(5){
            public String generate() {
                return pick(NOUN4); // 比如：超级大jury
            }
        },
        NOUN5_6_(2){
            public String generate() {
                return pick(NOUN5_6); // 比如：超级大jury
            }
        };



        private final int weight;

        NameTemplateEnum(int weight) {
            this.weight = weight;
        }

        public int getWeight() {
            return weight;
        }
        // 强制每个枚举实例必须实现自己的拼接逻辑
        public abstract String generate();
    }
}
