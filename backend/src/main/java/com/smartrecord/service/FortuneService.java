package com.smartrecord.service;

import com.smartrecord.dto.fortune.FortuneResp;

public interface FortuneService {

    /** 获取今日运势（大模型 + 兜底双引擎），force=true 时跳过缓存强制重新生成 */
    FortuneResp getTodayFortune(Long userId, boolean force);
}
