package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.Room;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface RoomMapper extends BaseMapper<Room> {

    @Select("SELECT all_record FROM room WHERE id = #{roomId}")
    String selectAllRecordById(@Param("roomId") Long roomId);
}
