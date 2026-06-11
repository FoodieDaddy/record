package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.UserAchievement;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户成就关系数据库操作接口。
 * 用于实现用户成就的达成记录存储、查询以及装扮状态的修改。
 */
@Mapper
public interface UserAchievementMapper extends BaseMapper<UserAchievement> {
}
