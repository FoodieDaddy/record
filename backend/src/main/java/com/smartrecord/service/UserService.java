package com.smartrecord.service;

import com.smartrecord.dto.user.*;

public interface UserService {

    LoginResp login(LoginReq req);

    UserInfoResp getUserInfo(Long userId);

    void updateUserInfo(Long userId, String nickname, String avatarUrl);

    UserDetailResp getUserDetail(Long userId);

    void updateUserDetail(Long userId, UpdateUserDetailReq req);
}
