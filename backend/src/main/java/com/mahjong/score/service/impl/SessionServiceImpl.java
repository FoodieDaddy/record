package com.mahjong.score.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.dto.session.CreateSessionReq;
import com.mahjong.score.dto.session.SessionResp;
import com.mahjong.score.entity.Room;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.Session;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMapper;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.SessionService;
import com.mahjong.score.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionServiceImpl implements SessionService {

    private final SessionMapper sessionMapper;
    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;

    @Override
    @Transactional
    public SessionResp createSession(Long userId, CreateSessionReq req) {
        Room room = roomMapper.selectById(req.getRoomId());
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间不存在或已关闭");
        }

        // Redis INCR 获取场次序号
        String counterKey = "mj:room:" + req.getRoomId() + ":session:counter";
        Long sessionNo = redisTemplate.opsForValue().increment(counterKey);
        redisTemplate.expire(counterKey, 24, TimeUnit.HOURS);

        Session session = new Session();
        session.setId(idGenerator.nextId());
        session.setRoomId(req.getRoomId());
        session.setSessionNo(sessionNo.intValue());
        session.setTitle(req.getTitle() != null ? req.getTitle() : "第" + sessionNo + "场");
        session.setStatus(0);
        session.setScoreCount(0);
        session.setCreatedBy(userId);
        sessionMapper.insert(session);

        // 初始化 Redis 场次数据
        String sessionPrefix = "mj:session:" + session.getId() + ":";
        redisTemplate.opsForZSet().add(sessionPrefix + "scores", "init", 0);
        redisTemplate.expire(sessionPrefix + "scores", 24, TimeUnit.HOURS);

        return buildSessionResp(session);
    }

    @Override
    public List<SessionResp> getSessionsByRoom(Long roomId, Integer page, Integer size) {
        List<Session> sessions = sessionMapper.selectList(
                new LambdaQueryWrapper<Session>()
                        .eq(Session::getRoomId, roomId)
                        .orderByDesc(Session::getSessionNo)
                        .last("LIMIT " + size + " OFFSET " + (page - 1) * size));

        return sessions.stream()
                .map(this::buildSessionResp)
                .collect(Collectors.toList());
    }


    private SessionResp buildSessionResp(Session session) {
        Map<Long, Integer> playerTotals = new HashMap<>();

        if (session.getStatus() == 0) {
            // 进行中 → 从 Redis 读取排行榜
            String scoresKey = "mj:session:" + session.getId() + ":scores";
            Set<ZSetOperations.TypedTuple<String>> tuples =
                    redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1);
            if (tuples != null) {
                for (ZSetOperations.TypedTuple<String> t : tuples) {
                    String uid = t.getValue();
                    if (uid != null && !"init".equals(uid)) {
                        playerTotals.put(Long.parseLong(uid), t.getScore().intValue());
                    }
                }
            }
        } else {
            // 已结算 → 从 MySQL 聚合
            // 通过 ScoreMapper 查询（这里直接用 sessionMapper 的方法链不够，注入 ScoreMapper）
            // 简化处理：用 MyBatis-Plus 的 mapper
            playerTotals = sessionMapper.getPlayerTotalsBySessionId(session.getId());
            if (playerTotals == null) playerTotals = Collections.emptyMap();
        }

        return SessionResp.builder()
                .sessionId(session.getId())
                .roomId(session.getRoomId())
                .sessionNo(session.getSessionNo())
                .title(session.getTitle())
                .status(session.getStatus())
                .scoreCount(session.getScoreCount())
                .playerTotals(playerTotals)
                .createdAt(session.getCreatedAt())
                .settledAt(session.getSettledAt())
                .build();
    }
}
