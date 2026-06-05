package com.smartrecord.service;

import com.smartrecord.dto.mirror.MbtiTestReq;
import com.smartrecord.dto.mirror.MirrorProfileResp;
import com.smartrecord.dto.mirror.MirrorProfileResp.ProfileInfo;
import com.smartrecord.entity.UserMirrorProfile;

public interface MirrorProfileService {

    /** 获取完整镜像画像（MBTI + 战绩画像 + 维度 + 判读） */
    MirrorProfileResp getFullProfile(Long userId);

    /** 提交 MBTI 20题测试 */
    ProfileInfo submitMbtiTest(Long userId, MbtiTestReq req);

    /** 直接设置 MBTI 类型 */
    ProfileInfo submitMbtiDirect(Long userId, int mbtiCode);

    /** 获取用户 MBTI profile（内部使用） */
    UserMirrorProfile getProfile(Long userId);

    /** 构建 ProfileInfo DTO */
    ProfileInfo toProfileInfo(Long userId);

    /** 清除画像缓存 */
    void clearProfileCache(Long userId);
}
