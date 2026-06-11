package com.smartrecord.service;

import com.smartrecord.common.BizException;
import com.smartrecord.dto.round.SubmitRoundReq;
import com.smartrecord.entity.Room;
import com.smartrecord.mapper.*;
import com.smartrecord.service.impl.RoundRecordServiceImpl;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.SnowflakeIdGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 本局录入服务单元测试
 */
@ExtendWith(MockitoExtension.class)
class RoundRecordServiceTest {

    @InjectMocks
    private RoundRecordServiceImpl roundRecordService;

    @Mock
    private RoomMapper roomMapper;
    @Mock
    private RoomMemberMapper roomMemberMapper;
    @Mock
    private RoundRecordMapper roundRecordMapper;
    @Mock
    private RoundRecordDetailMapper roundRecordDetailMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private SnowflakeIdGenerator idGenerator;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private RedissonClient redissonClient;
    @Mock
    private ScoreWebSocket scoreWebSocket;
    @Mock
    private EmotionAudioPool emotionAudioPool;
    @Mock
    private OverviewService overviewService;
    @Mock
    private SubscribeMessageService subscribeMessageService;
    @Mock
    private Executor asyncExecutor;

    @Mock
    private HashOperations<String, Object, Object> hashOps;
    @Mock
    private RLock rLock;

    // ===== startRound 测试 =====

    @Test
    @DisplayName("startRound：房间不存在时抛出异常")
    void testStartRound_RoomNotFound() {
        when(roomMapper.selectById(999L)).thenReturn(null);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.startRound(1L, 999L));
        assertEquals(4041, ex.getCode());
    }

    @Test
    @DisplayName("startRound：非房主操作时抛出异常")
    void testStartRound_NotOwner() {
        Room room = new Room();
        room.setId(1L);
        room.setOwnerId(100L);
        room.setStatus(0);
        room.setScoreMode(2); // 本局录入模式
        when(roomMapper.selectById(1L)).thenReturn(room);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.startRound(2L, 1L));
        assertEquals(4033, ex.getCode());
    }

    @Test
    @DisplayName("startRound：房间已封存时抛出异常")
    void testStartRound_RoomSealed() {
        Room room = new Room();
        room.setId(1L);
        room.setOwnerId(1L);
        room.setStatus(2); // 已封存
        room.setScoreMode(2);
        when(roomMapper.selectById(1L)).thenReturn(room);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.startRound(1L, 1L));
        assertEquals(4041, ex.getCode());
    }

    @Test
    @DisplayName("startRound：已有待处理轮次时抛出异常")
    void testStartRound_AlreadyPending() throws Exception {
        Room room = new Room();
        room.setId(1L);
        room.setOwnerId(1L);
        room.setStatus(0);
        room.setScoreMode(2); // 本局录入模式
        when(roomMapper.selectById(1L)).thenReturn(room);

        when(redissonClient.getLock(anyString())).thenReturn(rLock);
        when(rLock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);

        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        when(hashOps.hasKey(anyString(), eq("round:id"))).thenReturn(true);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.startRound(1L, 1L));
        assertEquals(4101, ex.getCode());
    }

    // ===== submitRound 测试 =====

    @Test
    @DisplayName("submitRound：轮次不存在时抛出异常")
    void testSubmitRound_RoundNotFound() throws Exception {
        Room room = new Room();
        room.setId(1L);
        room.setOwnerId(1L);
        room.setStatus(0);
        when(roomMapper.selectById(1L)).thenReturn(room);

        when(redissonClient.getLock(anyString())).thenReturn(rLock);
        when(rLock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);

        when(redisTemplate.opsForHash()).thenReturn(hashOps);
        when(hashOps.get(anyString(), eq("round:id"))).thenReturn(null);

        SubmitRoundReq req = new SubmitRoundReq();
        req.setRoomId(1L);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.submitRound(1L, req));
        assertEquals(4105, ex.getCode());
    }

    // ===== cancelRound 测试 =====

    @Test
    @DisplayName("cancelRound：房间不存在时抛出异常")
    void testCancelRound_RoomNotFound() {
        when(roomMapper.selectById(999L)).thenReturn(null);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.cancelRound(1L, 999L));
        assertEquals(4041, ex.getCode());
    }

    @Test
    @DisplayName("cancelRound：非房主操作时抛出异常")
    void testCancelRound_NotOwner() {
        Room room = new Room();
        room.setId(1L);
        room.setOwnerId(100L);
        when(roomMapper.selectById(1L)).thenReturn(room);

        BizException ex = assertThrows(BizException.class,
            () -> roundRecordService.cancelRound(2L, 1L));
        assertEquals(4034, ex.getCode());
    }
}
