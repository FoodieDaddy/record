package com.smartrecord.service;

import com.smartrecord.dto.user.*;

public interface UserService {

    LoginResp login(LoginReq req);

    UserInfoResp getUserInfo(Long userId);

    void updateUserInfo(Long userId, UpdateUserReq req);

    UserDetailResp getUserDetail(Long userId);

    void updateUserDetail(Long userId, UpdateUserDetailReq req);

    /**
     * 刷新用户缓存（包括基本信息和当前装备的装扮）并广播通知成员更新。
     *
     * @param userId 用户 ID
     */
    void refreshUserCacheAndNotify(Long userId);

    /**
     * 获取用户生涯驾驶舱汇总数据（包括总场次、胜率、黄金拍档及宿敌画像）
     *
     * @param userId 用户 ID
     * @return 个人生涯汇总数据
     */
    CareerCockpitResp getCareerCockpit(Long userId);
}
