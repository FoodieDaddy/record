package com.smartrecord.service;

import com.smartrecord.common.PageResult;
import com.smartrecord.dto.score.*;

import java.util.List;

public interface ScoreService {

    ScoreSubmitResp submitScore(Long userId, SubmitScoreReq req);

    /** 房间排行榜 */
    List<ScoreBatchResp.PlayerScoreVO> getRoomRanking(Long roomId);

    /** 房间最近记分记录 */
    List<ScoreBatchResp> getRoomRecentScores(Long roomId, Integer count);

    /** 结束对局，数据归档 */
    SettleResp settleRoom(Long userId, Long roomId, boolean autoSettled);

    /** 获取房间折线图数据 */
    ChartDataResp getChartData(Long roomId);

    /** 自由流转计分 */
    TransferScoreResp transferScore(Long userId, TransferScoreReq req);

    /** 房间计分流水（分页） */
    PageResult<TransferScoreResp> getRoomTransfers(Long roomId, int page, int size);
}
