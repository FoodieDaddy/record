package com.mahjong.score.service;

import com.mahjong.score.common.PageResult;
import com.mahjong.score.dto.transfer.TransferReq;
import com.mahjong.score.dto.transfer.TransferResp;

import java.util.List;

public interface TransferService {

    TransferResp transfer(Long userId, TransferReq req);

    List<TransferResp> getRoomTransfers(Long roomId);

    PageResult<TransferResp> getRoomTransfers(Long roomId, int page, int size);

    PageResult<TransferResp> getRoomTransfers(Long roomId, Long sessionId, int page, int size);

    void revokeTransfer(Long userId, Long transferId);
}
