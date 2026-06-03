package com.smartrecord.service;

import com.smartrecord.common.PageResult;
import com.smartrecord.dto.transfer.TransferReq;
import com.smartrecord.dto.transfer.TransferResp;

public interface TransferService {

    TransferResp transfer(Long userId, TransferReq req);

    PageResult<TransferResp> getRoomTransfers(Long roomId, int page, int size);

    PageResult<TransferResp> getRoomTransfers(Long roomId, Long sessionId, int page, int size);
}
