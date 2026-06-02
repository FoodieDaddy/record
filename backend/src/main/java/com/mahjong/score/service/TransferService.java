package com.mahjong.score.service;

import com.mahjong.score.dto.transfer.TransferReq;
import com.mahjong.score.dto.transfer.TransferResp;

import java.util.List;

public interface TransferService {

    TransferResp transfer(Long userId, TransferReq req);

    List<TransferResp> getRoomTransfers(Long roomId);

    void revokeTransfer(Long userId, Long transferId);
}
