package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.mapper.UserMirrorProfileMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminMirrorService {

    private final UserMirrorProfileMapper userMirrorProfileMapper;

    /**
     * 镜像档案列表（分页，按创建时间倒序）
     */
    public Page<UserMirrorProfile> listProfiles(int page, int size) {
        return userMirrorProfileMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<UserMirrorProfile>().orderByDesc(UserMirrorProfile::getCreatedAt));
    }

    /**
     * 镜像档案详情（按用户 ID）
     */
    public UserMirrorProfile getDetail(Long userId) {
        return userMirrorProfileMapper.selectById(userId);
    }
}
