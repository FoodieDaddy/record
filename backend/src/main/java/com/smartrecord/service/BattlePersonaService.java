package com.smartrecord.service;

import com.smartrecord.dto.mirror.MirrorProfileResp.BattlePersonaInfo;
import com.smartrecord.dto.mirror.MirrorProfileResp.DimensionInfo;
import com.smartrecord.dto.mirror.MirrorProfileResp.ReadingInfo;

import java.util.List;

public interface BattlePersonaService {

    /**
     * 计算战绩人格画像（含维度和判读）
     */
    BattlePersonaResult calculate(Long userId);

    /**
     * 生成镜像判读
     */
    ReadingInfo generateReading(String mbtiType, String personaTag);

    record BattlePersonaResult(
            BattlePersonaInfo persona,
            List<DimensionInfo> dimensions
    ) {}
}
