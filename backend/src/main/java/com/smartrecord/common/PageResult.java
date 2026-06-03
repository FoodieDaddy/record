package com.smartrecord.common;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "分页结果")
public class PageResult<T> {

    @Schema(description = "总记录数", example = "100")
    private long total;

    @Schema(description = "当前页数据")
    private List<T> records;

    public static <T> PageResult<T> of(long total, List<T> records) {
        PageResult<T> p = new PageResult<>();
        p.setTotal(total);
        p.setRecords(records);
        return p;
    }
}
