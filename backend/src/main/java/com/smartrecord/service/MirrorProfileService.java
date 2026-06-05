package com.smartrecord.service;

import com.smartrecord.dto.mirror.BirthProfileReq;
import com.smartrecord.dto.mirror.MbtiTestReq;
import com.smartrecord.dto.mirror.MirrorDashboardResp.ProfileInfo;
import com.smartrecord.entity.MirrorBirthProfile;
import com.smartrecord.entity.UserMirrorProfile;

public interface MirrorProfileService {

    /**
     * 提交 MBTI 20题测试
     */
    ProfileInfo submitMbtiTest(Long userId, MbtiTestReq req);

    /**
     * 直接设置 MBTI 类型
     */
    ProfileInfo submitMbtiDirect(Long userId, String mbtiType);

    /**
     * 保存出生档案
     */
    void saveBirthProfile(Long userId, BirthProfileReq req);

    /**
     * 获取出生档案
     */
    BirthProfileReq getBirthProfile(Long userId);

    /**
     * 获取用户 MBTI profile（内部使用）
     */
    UserMirrorProfile getProfile(Long userId);

    /**
     * 获取用户出生档案实体（内部使用）
     */
    MirrorBirthProfile getBirthProfileEntity(Long userId);
}
