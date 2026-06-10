package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.dto.admin.DashboardOverviewResp;
import com.smartrecord.dto.admin.TraceStatsResp;
import com.smartrecord.dto.admin.TrendDataResp;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.RoundRecordMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.entity.RoundRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final UserMapper userMapper;
    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final RoundRecordMapper roundRecordMapper;

    public DashboardOverviewResp getOverview() {
        return DashboardOverviewResp.builder()
            .totalUsers(userMapper.selectCount(null))
            .todayActiveUsers(0)
            .activeFormations(roomMapper.selectCount(null))
            .todaySealed(0)
            .todayTransfers(0)
            .todayRoundWrites(0)
            .build();
    }

    /**
     * 获取最近 30 天的趋势数据（用户增长、编队创建）
     */
    public TrendDataResp getTrends() {
        List<String> dates = new ArrayList<>();
        List<Long> userGrowth = new ArrayList<>();
        List<Long> formationCreated = new ArrayList<>();

        LocalDate today = LocalDate.now();
        for (int i = 29; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            dates.add(date.getMonthValue() + "/" + date.getDayOfMonth());

            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

            Long users = userMapper.selectCount(
                new LambdaQueryWrapper<User>()
                    .ge(User::getCreatedAt, dayStart)
                    .lt(User::getCreatedAt, dayEnd)
            );
            userGrowth.add(users);

            Long rooms = roomMapper.selectCount(
                new LambdaQueryWrapper<Room>()
                    .ge(Room::getCreatedAt, dayStart)
                    .lt(Room::getCreatedAt, dayEnd)
            );
            formationCreated.add(rooms);
        }

        return TrendDataResp.builder()
            .dates(dates)
            .userGrowth(userGrowth)
            .formationCreated(formationCreated)
            .build();
    }

    /**
     * 获取航迹中心统计数据：近 30 天封存趋势、高活跃用户、高活跃编队
     */
    public TraceStatsResp getTraceStats() {
        // 近 30 天封存航程趋势
        List<String> dates = new ArrayList<>();
        List<Long> sealedCounts = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (int i = 29; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            dates.add(date.getMonthValue() + "/" + date.getDayOfMonth());

            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

            Long sealed = roomMapper.selectCount(
                new LambdaQueryWrapper<Room>()
                    .eq(Room::getStatus, 1)
                    .ge(Room::getCreatedAt, dayStart)
                    .lt(Room::getCreatedAt, dayEnd)
            );
            sealedCounts.add(sealed);
        }

        // 高活跃用户：按参与封存航程数降序取 Top 10
        // 先查所有已封存房间的成员记录
        List<Room> sealedRooms = roomMapper.selectList(
            new LambdaQueryWrapper<Room>().eq(Room::getStatus, 1)
        );
        List<Long> sealedRoomIds = sealedRooms.stream().map(Room::getId).collect(Collectors.toList());

        // 统计每个用户参与的封存航程数和总脉冲
        Map<Long, long[]> userStats = new java.util.HashMap<>();
        if (!sealedRoomIds.isEmpty()) {
            // 分批查询避免 IN 子句过大
            int batchSize = 500;
            for (int i = 0; i < sealedRoomIds.size(); i += batchSize) {
                List<Long> batch = sealedRoomIds.subList(i, Math.min(i + batchSize, sealedRoomIds.size()));
                List<RoomMember> members = roomMemberMapper.selectList(
                    new LambdaQueryWrapper<RoomMember>()
                        .in(RoomMember::getRoomId, batch)
                        .isNotNull(RoomMember::getQuitTime)
                );
                for (RoomMember m : members) {
                    long[] stat = userStats.computeIfAbsent(m.getUserId(), k -> new long[]{0, 0});
                    stat[0]++; // 封存航程数
                    if (m.getFinalScore() != null) {
                        stat[1] += m.getFinalScore(); // 总脉冲
                    }
                }
            }
        }

        // 取 Top 10 用户
        List<Long> topUserIds = userStats.entrySet().stream()
            .sorted((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]))
            .limit(10)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

        // 批量查用户昵称
        Map<Long, String> nicknameMap = new java.util.HashMap<>();
        if (!topUserIds.isEmpty()) {
            List<User> users = userMapper.selectBatchIds(topUserIds);
            for (User u : users) {
                nicknameMap.put(u.getId(), u.getNickname());
            }
        }

        List<TraceStatsResp.UserRankItem> userRanks = topUserIds.stream()
            .map(uid -> {
                long[] stat = userStats.getOrDefault(uid, new long[]{0, 0});
                return TraceStatsResp.UserRankItem.builder()
                    .userId(uid)
                    .nickname(nicknameMap.getOrDefault(uid, "未知"))
                    .sealedCount(stat[0])
                    .totalScore(stat[1])
                    .build();
            })
            .collect(Collectors.toList());

        // 高活跃编队：按成员数降序取 Top 10（仅已封存）
        List<TraceStatsResp.FormationRankItem> formationRanks = sealedRooms.stream()
            .sorted((a, b) -> Long.compare(b.getId(), a.getId()))
            .limit(10)
            .map(r -> {
                Long memberCount = roomMemberMapper.selectCount(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, r.getId())
                );
                return TraceStatsResp.FormationRankItem.builder()
                    .roomId(r.getId())
                    .roomNo(r.getRoomNo())
                    .memberCount(memberCount != null ? memberCount.intValue() : 0)
                    .scoreMode(r.getScoreMode())
                    .build();
            })
            .collect(Collectors.toList());

        return TraceStatsResp.builder()
            .dates(dates)
            .sealedCounts(sealedCounts)
            .topUsers(userRanks)
            .topFormations(formationRanks)
            .build();
    }

    /**
     * 获取近期事件流：最近用户接入和编队动态
     */
    public List<Map<String, Object>> getRecentEvents() {
        List<Map<String, Object>> events = new ArrayList<>();

        // 最近接入的用户
        List<User> recentUsers = userMapper.selectList(
            new LambdaQueryWrapper<User>()
                .orderByDesc(User::getCreatedAt)
                .last("LIMIT 5")
        );
        for (User u : recentUsers) {
            String time = u.getCreatedAt() != null
                ? u.getCreatedAt().toString().substring(11, 16)
                : "--:--";
            events.add(Map.of(
                "time", time,
                "type", "join",
                "desc", (u.getNickname() != null ? u.getNickname() : "未知航船") + " 接入系统",
                "color", "green"
            ));
        }

        // 最近的编队动态
        List<Room> recentRooms = roomMapper.selectList(
            new LambdaQueryWrapper<Room>()
                .orderByDesc(Room::getCreatedAt)
                .last("LIMIT 5")
        );
        for (Room r : recentRooms) {
            String time = r.getCreatedAt() != null
                ? r.getCreatedAt().toString().substring(11, 16)
                : "--:--";
            boolean sealed = r.getStatus() != null && r.getStatus() == 1;
            events.add(Map.of(
                "time", time,
                "type", sealed ? "seal" : "create",
                "desc", sealed
                    ? "封存航程 " + r.getRoomNo()
                    : "创建编队 " + r.getRoomNo(),
                "color", sealed ? "green" : "blue"
            ));
        }

        // 按时间降序排列
        events.sort((a, b) -> ((String) b.get("time")).compareTo((String) a.get("time")));

        return events.size() > 10 ? events.subList(0, 10) : events;
    }

    /**
     * 脉冲流向统计：从已归档编队的 allRecord JSON 统计总流向数和总脉冲值
     */
    public Map<String, Object> getPulseStats() {
        List<Room> sealedRooms = roomMapper.selectList(
            new LambdaQueryWrapper<Room>().eq(Room::getStatus, 1)
        );

        long totalTransfers = 0;
        long totalPulseValue = 0;

        for (Room room : sealedRooms) {
            if (room.getAllRecord() != null) {
                totalTransfers += room.getAllRecord().size();
                for (Map<String, Object> record : room.getAllRecord()) {
                    Object amount = record.get("amount");
                    if (amount instanceof Number) {
                        totalPulseValue += ((Number) amount).longValue();
                    }
                }
            }
        }

        // 统计航段写入
        Long totalRounds = roundRecordMapper.selectCount(null);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalTransfers", totalTransfers);
        stats.put("totalPulseValue", totalPulseValue);
        stats.put("totalRounds", totalRounds);
        stats.put("sealedRooms", sealedRooms.size());

        return stats;
    }

    /**
     * 脉冲流向趋势（近 30 天）：按日统计航段写入数和脉冲流向数
     */
    public TrendDataResp getPulseTrends() {
        List<String> dates = new ArrayList<>();
        List<Long> transferCounts = new ArrayList<>();
        List<Long> roundCounts = new ArrayList<>();

        LocalDate today = LocalDate.now();
        for (int i = 29; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            dates.add(date.getMonthValue() + "/" + date.getDayOfMonth());

            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

            // 航段写入统计
            Long rounds = roundRecordMapper.selectCount(
                new LambdaQueryWrapper<RoundRecord>()
                    .ge(RoundRecord::getCreatedAt, dayStart)
                    .lt(RoundRecord::getCreatedAt, dayEnd)
            );
            roundCounts.add(rounds);

            // 脉冲流向（从当日归档的编队统计）
            Long transfers = 0L;
            List<Room> dayRooms = roomMapper.selectList(
                new LambdaQueryWrapper<Room>()
                    .eq(Room::getStatus, 1)
                    .ge(Room::getCreatedAt, dayStart)
                    .lt(Room::getCreatedAt, dayEnd)
            );
            for (Room room : dayRooms) {
                if (room.getAllRecord() != null) {
                    transfers += room.getAllRecord().size();
                }
            }
            transferCounts.add(transfers);
        }

        return TrendDataResp.builder()
            .dates(dates)
            .userGrowth(transferCounts)
            .formationCreated(roundCounts)
            .build();
    }
}
