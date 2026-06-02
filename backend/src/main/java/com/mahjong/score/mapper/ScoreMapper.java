package com.mahjong.score.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mahjong.score.entity.Score;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ScoreMapper extends BaseMapper<Score> {

    void insertBatch(@Param("list") List<Score> scores);
}
