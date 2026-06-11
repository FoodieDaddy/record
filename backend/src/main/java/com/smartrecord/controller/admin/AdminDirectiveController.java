package com.smartrecord.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.Result;
import com.smartrecord.dto.admin.AdminDirectiveResp;
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
    public Result<?> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String requestId) {
        Page<FortuneLog> logPage = directiveService.listLogs(page, size, userId, requestId);
        return Result.ok(logPage.convert(AdminDirectiveResp::from));
    }

    @Operation(summary = "指令日志详情")
    @GetMapping("/logs/{id}")
    public Result<AdminDirectiveResp> detail(@PathVariable Long id) {
        FortuneLog log = directiveService.getDetail(id);
        return Result.ok(AdminDirectiveResp.from(log));
    }
}
