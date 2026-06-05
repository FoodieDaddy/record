package com.smartrecord.service;

import com.smartrecord.dto.mirror.MirrorInterpretation;
import com.smartrecord.dto.mirror.TaibuRunResult;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.enums.MirrorToolType;

public interface MirrorInterpretService {

    /**
     * 生成镜像解释
     * @param toolType 工具类型
     * @param taibuResult taibu 返回结果
     * @param question 用户问题
     * @param profile MBTI 人格信息（可为 null）
     * @return 解释结果
     */
    MirrorInterpretation interpret(MirrorToolType toolType, TaibuRunResult taibuResult,
                                   String question, UserMirrorProfile profile);
}
