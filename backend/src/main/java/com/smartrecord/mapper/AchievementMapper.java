package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.Achievement;
import org.apache.ibatis.annotations.Mapper;

/**
 * 成就定义配置数据库操作接口。
 * 提供对系统内置成就信息的查询与管理。
 */
@Mapper
public interface AchievementMapper extends BaseMapper<Achievement> {
}
