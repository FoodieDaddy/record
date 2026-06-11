package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.BehaviorLog;
import org.apache.ibatis.annotations.Mapper;

/**
 * 行为日志 Mapper 接口
 */
@Mapper
public interface BehaviorLogMapper extends BaseMapper<BehaviorLog> {
}
