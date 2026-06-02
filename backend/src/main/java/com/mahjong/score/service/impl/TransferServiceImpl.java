package com.mahjong.score.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.dto.transfer.TransferReq;
import com.mahjong.score.dto.transfer.TransferResp;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.Session;
import com.mahjong.score.entity.Transfer;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.mapper.TransferMapper;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.TransferService;
import com.mahjong.score.service.impl.ws.ScoreWebSocket;
import com.mahjong.score.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransferServiceImpl implements TransferService {

    private static final String SESSION_PREFIX = "mj:session:";

    private final TransferMapper transferMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final SessionMapper sessionMapper;
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final ScoreWebSocket scoreWebSocket;

    @Override
    public TransferResp transfer(Long userId, TransferReq req) {
        // 不能给自己转账
        if (userId.equals(req.getToUserId())) {
            throw new BizException("不能给自己转账");
        }

        // 验证双方都是房间成员
        RoomMember fromMember = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, req.getRoomId())
                        .eq(RoomMember::getUserId, userId));
        RoomMember toMember = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, req.getRoomId())
                        .eq(RoomMember::getUserId, req.getToUserId()));

        if (fromMember == null || toMember == null) {
            throw new BizException("双方必须都是房间成员");
        }

        Transfer transfer = new Transfer();
        transfer.setId(idGenerator.nextId());
        transfer.setRoomId(req.getRoomId());
        transfer.setFromUserId(userId);
        transfer.setToUserId(req.getToUserId());
        transfer.setAmount(req.getAmount());
        transfer.setRemark(req.getRemark());
        transfer.setStatus(0);
        transferMapper.insert(transfer);

        // 更新 Redis 排行榜：付款方扣分，收款方加分
        Session session = sessionMapper.selectOne(
                new LambdaQueryWrapper<Session>()
                        .eq(Session::getRoomId, req.getRoomId())
                        .eq(Session::getStatus, 0)
                        .last("LIMIT 1"));
        if (session != null) {
            String scoresKey = SESSION_PREFIX + session.getId() + ":scores";
            redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(userId), -req.getAmount());
            redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(req.getToUserId()), req.getAmount());
            redisTemplate.expire(scoresKey, 24, TimeUnit.HOURS);
        }

        // WebSocket 推送给房间内所有玩家
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "TRANSFER");
        pushData.put("roomId", req.getRoomId());
        pushData.put("fromUserId", userId);
        pushData.put("toUserId", req.getToUserId());
        pushData.put("amount", req.getAmount());
        scoreWebSocket.pushToRoom(String.valueOf(req.getRoomId()), pushData);

        return buildResp(transfer);
    }

    @Override
    public List<TransferResp> getRoomTransfers(Long roomId) {
        List<Transfer> transfers = transferMapper.selectList(
                new LambdaQueryWrapper<Transfer>()
                        .eq(Transfer::getRoomId, roomId)
                        .orderByDesc(Transfer::getCreatedAt));

        return transfers.stream()
                .map(this::buildResp)
                .collect(Collectors.toList());
    }

    @Override
    public void revokeTransfer(Long userId, Long transferId) {
        Transfer transfer = transferMapper.selectById(transferId);
        if (transfer == null) throw new BizException("转账记录不存在");
        if (!transfer.getFromUserId().equals(userId)) throw new BizException("只有转账人可以撤回");
        if (transfer.getStatus() != 0) throw new BizException("该转账已撤回");

        // 5 分钟内可撤回
        LocalDateTime deadline = transfer.getCreatedAt().plusMinutes(5);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw new BizException("超过 5 分钟无法撤回");
        }

        transfer.setStatus(1);
        transferMapper.updateById(transfer);
    }

    private TransferResp buildResp(Transfer t) {
        User from = userMapper.selectById(t.getFromUserId());
        User to = userMapper.selectById(t.getToUserId());

        return TransferResp.builder()
                .id(t.getId())
                .fromUser(TransferResp.UserInfo.builder()
                        .userId(t.getFromUserId())
                        .nickname(from != null ? from.getNickname() : "")
                        .avatarUrl(from != null ? from.getAvatarUrl() : "")
                        .build())
                .toUser(TransferResp.UserInfo.builder()
                        .userId(t.getToUserId())
                        .nickname(to != null ? to.getNickname() : "")
                        .avatarUrl(to != null ? to.getAvatarUrl() : "")
                        .build())
                .amount(t.getAmount())
                .amountDisplay(String.format("%.2f", t.getAmount() / 100.0))
                .remark(t.getRemark())
                .status(t.getStatus())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
