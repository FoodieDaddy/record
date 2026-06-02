package com.mahjong.score.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mahjong.score.entity.SessionRecord;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface SessionRecordMapper extends BaseMapper<SessionRecord> {

    void insertBatch(@Param("list") List<SessionRecord> records);
}
