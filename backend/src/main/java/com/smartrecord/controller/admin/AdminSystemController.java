package com.smartrecord.controller.admin;

import com.smartrecord.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Admin 系统监控")
@RestController
@RequestMapping("/admin/system")
public class AdminSystemController {

    @Operation(summary = "系统健康状态")
    @GetMapping("/health")
    public Result<List<Map<String, Object>>> health() {
        return Result.ok(List.of(
                Map.of("name", "API 服务", "status", "ok", "latency", "12ms"),
                Map.of("name", "MySQL", "status", "ok", "latency", "3ms"),
                Map.of("name", "Redis", "status", "ok", "latency", "1ms"),
                Map.of("name", "WebSocket", "status", "ok", "latency", "-"),
                Map.of("name", "CloudBase 存储", "status", "ok", "latency", "45ms"),
                Map.of("name", "TTS 主引擎", "status", "warn", "latency", "890ms"),
                Map.of("name", "TTS 副引擎", "status", "ok", "latency", "320ms"),
                Map.of("name", "导航主引擎", "status", "ok", "latency", "2.1s")
        ));
    }

    @Operation(summary = "告警列表")
    @GetMapping("/alerts")
    public Result<Map<String, Object>> alerts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(Map.of("records", List.of(), "total", 0));
    }
}
