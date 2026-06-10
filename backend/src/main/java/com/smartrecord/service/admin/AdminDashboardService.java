package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.dto.admin.DashboardOverviewResp;
import com.smartrecord.dto.admin.TrendDataResp;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final UserMapper userMapper;
    private final RoomMapper roomMapper;

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
}
