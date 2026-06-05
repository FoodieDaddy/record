package com.smartrecord.controller;

import com.smartrecord.common.Result;
import com.smartrecord.service.TaibuService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "太乙命理", description = "taibu-core 命理计算引擎")
@RestController
@RequestMapping("/taibu")
@RequiredArgsConstructor
public class TaibuController {

    private final TaibuService taibuService;

    @Operation(summary = "获取可用域列表")
    @GetMapping("/domains")
    public Result<List<String>> getDomains() {
        return Result.ok(taibuService.getAvailableDomains());
    }

    @Operation(summary = "执行命理计算")
    @PostMapping("/{domain}")
    public Result<String> execute(
            @Parameter(description = "域名（如 taiyi, bazi, tarot）") @PathVariable String domain,
            @RequestBody String inputJson) {
        String result = taibuService.execute(domain, inputJson);
        return Result.ok(result);
    }
}
