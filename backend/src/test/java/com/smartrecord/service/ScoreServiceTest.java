package com.smartrecord.service;

import com.smartrecord.common.BizException;
import com.smartrecord.dto.score.SubmitScoreReq;
import com.smartrecord.entity.Room;
import com.smartrecord.mapper.*;
import com.smartrecord.service.impl.ScoreServiceImpl;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

import java.util.List;
import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 计分服务单元测试
 */
@ExtendWith(MockitoExtension.class)
class ScoreServiceTest {

    @InjectMocks
    private ScoreServiceImpl scoreService;

    @Mock
    private RoomMapper roomMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private RoomMemberMapper roomMemberMapper;
    @Mock
    private RoundRecordMapper roundRecordMapper;
    @Mock
    private RoundRecordDetailMapper roundRecordDetailMapper;
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
    private IdentityLevelService identityLevelService;
    @Mock
    private RoomService roomService;
    @Mock
    private Executor asyncExecutor;

    @Mock
    private ZSetOperations<String, String> zSetOps;
    @Mock
    private RLock rLock;

    @Test
    @DisplayName("提交分数：房间不存在时抛出异常")
    void testSubmitScore_RoomNotFound() {
        when(roomMapper.selectById(999L)).thenReturn(null);

        SubmitScoreReq req = new SubmitScoreReq();
        req.setRoomId(999L);
        SubmitScoreReq.PlayerScore ps = new SubmitScoreReq.PlayerScore();
        ps.setUserId(2L);
        ps.setScore(10);
        req.setScores(List.of(ps));

        BizException ex = assertThrows(BizException.class,
            () -> scoreService.submitScore(1L, req));
        assertTrue(ex.getMessage().contains("不存在") || ex.getMessage().contains("封存"));
    }

    @Test
    @DisplayName("提交分数：房间已封存时抛出异常")
    void testSubmitScore_RoomSealed() {
        Room room = new Room();
        room.setId(100L);
        room.setStatus(2); // 已封存
        when(roomMapper.selectById(100L)).thenReturn(room);

        SubmitScoreReq req = new SubmitScoreReq();
        req.setRoomId(100L);
        SubmitScoreReq.PlayerScore ps = new SubmitScoreReq.PlayerScore();
        ps.setUserId(2L);
        ps.setScore(10);
        req.setScores(List.of(ps));

        BizException ex = assertThrows(BizException.class,
            () -> scoreService.submitScore(1L, req));
        assertTrue(ex.getMessage().contains("不存在") || ex.getMessage().contains("封存"));
    }

    @Test
    @DisplayName("提交分数：roomId 为空时抛出异常")
    void testSubmitScore_NullRoomId() {
        SubmitScoreReq req = new SubmitScoreReq();
        req.setRoomId(null);
        req.setScores(List.of());

        BizException ex = assertThrows(BizException.class,
            () -> scoreService.submitScore(1L, req));
        assertTrue(ex.getMessage().contains("编队 ID"));
    }
}
