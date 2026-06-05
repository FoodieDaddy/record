package com.smartrecord.service;

import com.smartrecord.dto.round.ConfirmRoundReq;
import com.smartrecord.dto.round.RoundRecordResp;
import com.smartrecord.dto.round.SubmitRoundReq;

public interface RoundRecordService {

    /** 房主发起本局录 */
    RoundRecordResp startRound(Long userId, Long roomId);

    /** 房主填写提交 / 成员自填提交 */
    RoundRecordResp submitRound(Long userId, SubmitRoundReq req);

    /** 全员确认（同意/驳回） */
    RoundRecordResp confirmRound(Long userId, ConfirmRoundReq req);

    /** 房主取消待处理录 */
    void cancelRound(Long userId, Long roomId);

    /** 获取当前待处理录 */
    RoundRecordResp getPending(Long roomId);
}
