package com.smartrecord.dto.fortune;

/**
 * 用户历史画像标签 — 基于近 10 场净积分计算
 * [Round4] 注释统一为正反馈/负反馈语义，避免旧风格词直出
 */
public enum UserTag {

    /** 近期连续正反馈/状态高昂 */
    WINNING_STREAK,
    /** 近期连续负反馈/状态低迷 */
    LOSING_STREAK,
    /** 高波动型（数值起伏剧烈） */
    HIGH_RISK,
    /** 稳健型 */
    STABLE
}
