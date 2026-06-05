package com.smartrecord.service;

import com.smartrecord.dto.mirror.MirrorToolRunReq;
import com.smartrecord.dto.mirror.MirrorToolRunResp;

public interface MirrorToolService {

    /**
     * 运行镜像工具
     */
    MirrorToolRunResp runTool(Long userId, MirrorToolRunReq req);
}
