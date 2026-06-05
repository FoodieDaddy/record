package com.smartrecord.dto.mirror;

import lombok.Data;
import lombok.Builder;

import java.util.Map;

@Data
@Builder
public class TaibuRunResult {

    private boolean success;

    private Map<String, Object> rawResult;

    private Map<String, Object> normalizedResult;

    private String error;
}
