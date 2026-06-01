package com.mahjong.score.service;

import com.mahjong.score.dto.user.LoginReq;
import com.mahjong.score.dto.user.LoginResp;
import com.mahjong.score.dto.user.UserInfoResp;

public interface UserService {

    LoginResp login(LoginReq req);

    UserInfoResp getUserInfo(Long userId);

    void updateUserInfo(Long userId, String nickname, String avatarUrl);
}
