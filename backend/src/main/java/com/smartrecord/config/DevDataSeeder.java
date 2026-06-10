package com.smartrecord.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.entity.*;
import com.smartrecord.mapper.*;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 开发环境种子数据生成器
 * 仅在 local profile 下运行，生成测试用户、编队、运势日志和镜像档案
 */
@Slf4j
@Component
@Profile("local")
@RequiredArgsConstructor
public class DevDataSeeder implements CommandLineRunner {

    private final UserMapper userMapper;
    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final FortuneLogMapper fortuneLogMapper;
    private final UserMirrorProfileMapper userMirrorProfileMapper;
    private final SnowflakeIdGenerator idGenerator;

    @Override
    public void run(String... args) {
        if (userMapper.selectCount(null) > 1) {
            log.info("开发数据已存在，跳过种子数据生成");
            return;
        }

        log.info("生成开发种子数据...");
        Random rand = new Random(42);

        // ── 10 个测试用户 ──
        String[] names = {
                "星辰", "月影", "日曜", "云帆", "风行",
                "雷鸣", "海潮", "山岳", "流光", "暗夜"
        };
        List<Long> userIds = new ArrayList<>();
        for (int i = 0; i < names.length; i++) {
            User user = new User();
            long uid = idGenerator.nextId();
            user.setId(uid);
            user.setOpenid("dev_openid_" + i);
            user.setNickname(names[i]);
            user.setAvatarUrl("https://api.dicebear.com/7.x/bottts-neutral/svg?seed=" + i);
            user.setStatus(1);
            userMapper.insert(user);
            userIds.add(uid);
        }

        // ── 5 个编队 ──
        List<Long> roomIds = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Long ownerId = userIds.get(rand.nextInt(userIds.size()));
            Room room = new Room();
            long rid = idGenerator.nextId();
            room.setId(rid);
            room.setRoomNo(String.format("%06d", 100000 + rand.nextInt(900000)));
            room.setOwnerId(ownerId);
            room.setScoreMode(i % 2 == 0 ? 1 : 2);
            room.setRoundInputMethod(i % 2 == 0 ? 1 : 2);
            room.setTrustMode(1);
            room.setZeroSumRequired(0);
            room.setStatus(i < 3 ? 0 : 1); // 3 个进行中, 2 个已归档
            room.setLastActiveAt(LocalDateTime.now().minusHours(rand.nextInt(48)));
            roomMapper.insert(room);
            roomIds.add(rid);

            // 给每个编队分配 3-6 个成员
            int memberCount = 3 + rand.nextInt(4);
            Set<Long> assigned = new HashSet<>();
            for (int j = 0; j < memberCount && j < userIds.size(); j++) {
                Long userId = userIds.get((i + j) % userIds.size());
                if (!assigned.add(userId)) continue;

                RoomMember rm = new RoomMember();
                rm.setId(idGenerator.nextId());
                rm.setRoomId(rid);
                rm.setUserId(userId);
                if (room.getStatus() == 1) {
                    rm.setFinalScore(rand.nextInt(300) - 100);
                }
                roomMemberMapper.insert(rm);
            }
        }

        // ── 运势日志 ──
        String[] sources = {"daily", "weekly", "battle"};
        String[] results = {
                "{\"fortune\":\"大吉\",\"advice\":\"今日适合组队挑战\"}",
                "{\"fortune\":\"中吉\",\"advice\":\"保持节奏稳步前进\"}",
                "{\"fortune\":\"小吉\",\"advice\":\"注意能量分配\"}"
        };
        for (int i = 0; i < 8; i++) {
            FortuneLog logEntry = new FortuneLog();
            logEntry.setId(idGenerator.nextId());
            logEntry.setUserId(userIds.get(i % userIds.size()));
            logEntry.setUserTag("dev_user_" + (i % userIds.size()));
            logEntry.setSource(sources[i % sources.length]);
            logEntry.setModel("gpt-4o-mini");
            logEntry.setPrompt("生成今日运势");
            logEntry.setSystemPrompt("你是一个运势生成器");
            logEntry.setRawResponse(results[i % results.length]);
            logEntry.setResultJson(results[i % results.length]);
            logEntry.setDurationMs(200 + rand.nextInt(800));
            logEntry.setSuccess(1);
            fortuneLogMapper.insert(logEntry);
        }

        // ── 镜像档案 ──
        String[] personas = {"稳健型", "激进型", "协作型", "策略型", "直觉型"};
        String[] titles = {"稳如磐石", "闪电突袭", "星链织网", "棋局大师", "第六感舰长"};
        for (int i = 0; i < 5; i++) {
            UserMirrorProfile profile = new UserMirrorProfile();
            profile.setUserId(userIds.get(i));
            profile.setMbtiCode(1 + rand.nextInt(16));
            profile.setMbtiSource("test_v1");
            profile.setMbtiConfidence(new BigDecimal("0." + (70 + rand.nextInt(25))));
            profile.setCalibratedAt(LocalDateTime.now().minusDays(rand.nextInt(14)));
            profile.setBattlePersonaTag("persona_" + i);
            profile.setBattlePersonaTitle(titles[i]);
            profile.setBattlePersonaSummary("该舰员在过往任务中展现出" + personas[i] + "的风格特征");
            profile.setSampleSize(10 + rand.nextInt(40));
            profile.setPersonaCalculatedAt(LocalDateTime.now().minusDays(rand.nextInt(7)));
            userMirrorProfileMapper.insert(profile);
        }

        log.info("开发种子数据生成完成: {} 用户, {} 编队, {} 运势日志, {} 镜像档案",
                userIds.size(), roomIds.size(), 8, 5);
    }
}
