package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.entity.FortuneLog;
import com.smartrecord.service.admin.AdminDirectiveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Admin 指令日志")
@RestController
@RequestMapping("/admin/directives")
@RequiredArgsConstructor
public class AdminDirectiveController {

    private final AdminDirectiveService directiveService;

    @Operation(summary = "指令日志列表")
    @GetMapping("/logs")
    public Result<Page<FortuneLog>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(directiveService.listLogs(page, size));
    }

    @Operation(summary = "指令日志详情")
    @GetMapping("/logs/{id}")
    public Result<FortuneLog> detail(@PathVariable Long id) {
        return Result.ok(directiveService.getDetail(id));
    }
}
