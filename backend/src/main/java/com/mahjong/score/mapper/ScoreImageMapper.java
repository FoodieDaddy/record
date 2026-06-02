package com.mahjong.score.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mahjong.score.entity.ScoreImage;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ScoreImageMapper extends BaseMapper<ScoreImage> {

    void insertBatch(@Param("list") List<ScoreImage> images);
}
