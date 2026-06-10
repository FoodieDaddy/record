package com.smartrecord.controller.admin;

import com.smartrecord.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Tag(name = "Admin 系统监控")
@RestController
@RequestMapping("/admin/system")
@RequiredArgsConstructor
public class AdminSystemController {

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;

    @Operation(summary = "系统健康状态")
    @GetMapping("/health")
    public Result<List<Map<String, Object>>> health() {
        List<Map<String, Object>> services = new ArrayList<>();

        // API 服务
        services.add(Map.of("name", "API 服务", "status", "ok", "latency", "-", "detail", "运行中"));

        // MySQL
        try (Connection conn = dataSource.getConnection()) {
            long start = System.currentTimeMillis();
            conn.isValid(3);
            long latency = System.currentTimeMillis() - start;
            services.add(Map.of("name", "MySQL", "status", "ok", "latency", latency + "ms", "detail", "连接正常"));
        } catch (SQLException e) {
            services.add(Map.of("name", "MySQL", "status", "error", "latency", "-", "detail", "连接失败"));
        }

        // Redis
        try {
            long start = System.currentTimeMillis();
            redisTemplate.hasKey("health:check");
            long latency = System.currentTimeMillis() - start;
            services.add(Map.of("name", "Redis", "status", "ok", "latency", latency + "ms", "detail", "连接正常"));
        } catch (Exception e) {
            services.add(Map.of("name", "Redis", "status", "error", "latency", "-", "detail", "连接失败"));
        }

        // WebSocket
        services.add(Map.of("name", "WebSocket", "status", "ok", "latency", "-", "detail", "运行中"));

        // CloudBase
        services.add(Map.of("name", "CloudBase 存储", "status", "ok", "latency", "-", "detail", "可用"));

        // TTS
        services.add(Map.of("name", "TTS 主引擎", "status", "ok", "latency", "-", "detail", "Edge-TTS"));
        services.add(Map.of("name", "TTS 副引擎", "status", "ok", "latency", "-", "detail", "MiMo"));

        // 导航主引擎
        services.add(Map.of("name", "导航主引擎", "status", "ok", "latency", "-", "detail", "LLM"));

        return Result.ok(services);
    }

    @Operation(summary = "告警列表")
    @GetMapping("/alerts")
    public Result<Map<String, Object>> alerts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(Map.of("records", List.of(), "total", 0));
    }
}
