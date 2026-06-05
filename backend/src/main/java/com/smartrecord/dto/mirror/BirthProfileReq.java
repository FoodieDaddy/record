package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "出生档案保存请求")
public class BirthProfileReq {

    @Schema(description = "历法: solar/lunar", example = "solar")
    private String calendarType;

    @Schema(description = "出生日期", example = "1990-05-15")
    private String birthDate;

    @Schema(description = "出生时间", example = "15:00")
    private String birthTime;

    @Schema(description = "出生地", example = "北京")
    private String birthPlace;

    @Schema(description = "时区", example = "Asia/Shanghai")
    private String timezone;

    @Schema(description = "性别", example = "male")
    private String gender;
}
