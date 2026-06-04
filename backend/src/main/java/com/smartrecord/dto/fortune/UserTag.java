package com.smartrecord.dto.fortune;

/**
 * 用户历史画像标签 — 基于近 10 场净积分计算
 */
public enum UserTag {

    /** 近期连胜/高昂 */
    WINNING_STREAK,
    /** 近期连败/低迷 */
    LOSING_STREAK,
    /** 大输大赢型（波动剧烈） */
    HIGH_RISK,
    /** 稳健型 */
    STABLE
}
