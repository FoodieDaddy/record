package com.smartrecord.service;

import com.smartrecord.dto.mirror.MirrorDashboardResp;

public interface MirrorService {

    /**
     * 获取镜像首页聚合数据
     */
    MirrorDashboardResp getDashboard(Long userId);
}
