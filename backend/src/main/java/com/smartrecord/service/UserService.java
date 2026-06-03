package com.smartrecord.service;

import com.smartrecord.dto.user.LoginReq;
import com.smartrecord.dto.user.LoginResp;
import com.smartrecord.dto.user.UserInfoResp;

public interface UserService {

    LoginResp login(LoginReq req);

    UserInfoResp getUserInfo(Long userId);

    void updateUserInfo(Long userId, String nickname, String avatarUrl);
}
