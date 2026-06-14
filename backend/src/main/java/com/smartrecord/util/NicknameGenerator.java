package com.smartrecord.util;

import lombok.Getter;

import java.util.Random;

/**
 * 记分场景昵称生成器（≤6 字符版）
 * 所有组合严格控制在 6 个字符以内
 */
public class NicknameGenerator {

    /** 2 字符前置修饰语 */
    private static final String[] ADJ2 = {
            "深空", "冷静", "静默", "星港", "航电", "蓝光", "银翼", "低噪",
            "稳态", "夜航", "巡航", "极轨", "脉冲", "量测", "同步", "校准",
            "记录", "矩阵", "回路", "信标", "舱段", "终端", "观测", "复盘"
    };

    /** 3 字符前置修饰语 */
    private static final String[] ADJ3 = {
            "低噪的", "校准中", "巡航中", "同步中", "观测中", "待命中",
            "稳态的", "深空的", "航电的", "矩阵的", "冷启动", "微光的",
            "蓝移的", "静默的", "归档中", "复盘中", "信标的", "舱内的"
    };

    /** 4 字符名词/状态/成语（主打一个人设） */
    private static final String[] NOUN4 = {
            "星轨巡游", "仪表校准", "声纳回响", "数据回环", "舰桥待命",
            "低噪观测", "航电巡检", "空间记录", "脉冲归档", "矩阵同步",
            "信标常亮", "冷光复盘", "轨道校时", "终端在线", "蓝光记录",
            "回路稳定", "舱段巡查", "静默采样", "态势观察", "协议就绪"
    };

    /** 5~6 字符长前缀/长状态 */
    private static final String[] NOUN5_6 = {
            "星港调度员", "穿梭机长", "局外观察员", "跨域通信员", "舰桥播报员",
            "矩阵记录员", "轨道巡检员", "深空校准员", "低噪观察员", "脉冲归档员",
            "航电同步员", "空间接入员"
    };

    /** 1~2 字符称呼/头衔 */
    private static final String[] NAME2 = {
            "舵手", "领航", "舰桥", "星港", "通信",
            "夜航", "地勤", "热舱", "巡检", "护盾", "脉冲", "航电", "引擎",
            "星轨", "搭档", "听客", "记录", "矩阵", "信标", "雷达", "舱段",
            "终端", "样本", "节点", "回路", "静默", "蓝光", "银翼", "归档",
            "校时", "控台", "接入", "观测", "复盘", "协议"
    };

    /** 3 字符称呼/头衔 */
    private static final String[] NAME3 = {
            "扫描员", "练习生", "记录官", "细节控", "护航员", "监听者",
            "守门员", "星航员", "主理人", "主心骨", "老玩家", "调度员",
            "校准员", "巡检员", "观察员", "同步员", "归档员", "接入员",
            "值班员", "复盘员", "读数员", "控台手", "信标员", "样本员"
    };


    /** 1~2 字符动作/结尾词 */
    private static final String[] SUFFIX2 = {
            "启动", "待命", "接入", "同步", "校准", "巡检", "记录", "复盘",
            "归档", "上线", "读数", "观测", "回传", "采样", "静默", "校时"
    };

    /** 3 字符动作/结尾词 */
    private static final String[] SUFFIX3 = {
            "已接入", "已同步", "已校准", "已待命", "已归档", "巡航中",
            "观测中", "记录中", "复盘中", "低噪中", "回传中", "校时中"
    };

    /** 4 字符动作/结尾词 */
    private static final String[] SUFFIX4 = {
            "进入巡航", "保持低噪", "完成校准", "完成同步", "等待接入",
            "记录就绪", "归档就绪", "信标常亮", "航电在线", "矩阵在线",
            "回路稳定", "样本就绪"
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
