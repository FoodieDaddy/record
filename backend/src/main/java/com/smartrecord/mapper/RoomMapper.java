package com.smartrecord.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smartrecord.entity.Room;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface RoomMapper extends BaseMapper<Room> {

    @Select("SELECT all_record FROM room WHERE id = #{roomId}")
    String selectAllRecordById(@Param("roomId") Long roomId);

    @Update("""
            UPDATE room
            SET status = #{status},
                all_record = #{allRecordJson},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = #{roomId}
            """)
    int archiveRoomRecord(@Param("roomId") Long roomId,
                          @Param("status") Integer status,
                          @Param("allRecordJson") String allRecordJson);
}
