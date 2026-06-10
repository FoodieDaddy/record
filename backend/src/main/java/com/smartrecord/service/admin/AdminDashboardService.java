package com.smartrecord.service.admin;

import com.smartrecord.dto.admin.DashboardOverviewResp;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
}
