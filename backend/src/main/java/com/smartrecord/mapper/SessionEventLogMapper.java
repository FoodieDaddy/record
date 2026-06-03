package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.SessionEventLog;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

public interface SessionEventLogMapper extends BaseMapper<SessionEventLog> {

    /**
     * 分批删除过期记录
     * @param cutoff 90天前的时间点
     * @param limit 每批删除数量
     * @return 受影响行数
     */
    int batchDeleteExpired(@Param("cutoff") LocalDateTime cutoff, @Param("limit") int limit);
}
