package com.smartrecord.service;

import com.smartrecord.dto.user.IdentityLevelResp;

public interface IdentityLevelService {

    /**
     * 获取用户身份等级（优先读缓存，无缓存时实时计算）
     */
    IdentityLevelResp getIdentityLevel(Long userId);

    /**
     * 重新计算指定用户的身份等级（settle 后异步调用）
     */
    void recalculate(Long userId);
}
