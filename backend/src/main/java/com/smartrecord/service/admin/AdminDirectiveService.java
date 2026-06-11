package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.entity.FortuneLog;
import com.smartrecord.mapper.FortuneLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminDirectiveService {

    private final FortuneLogMapper fortuneLogMapper;

    /**
     * 指令日志列表（分页，根据 userId/requestId 过滤，按创建时间倒序）
     */
    public Page<FortuneLog> listLogs(int page, int size, Long userId, String requestId) {
        LambdaQueryWrapper<FortuneLog> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(userId != null, FortuneLog::getUserId, userId);
        queryWrapper.eq(requestId != null && !requestId.isBlank(), FortuneLog::getRequestId, requestId);
        queryWrapper.orderByDesc(FortuneLog::getCreatedAt);
        return fortuneLogMapper.selectPage(new Page<>(page, size), queryWrapper);
    }

    /**
     * 指令日志详情
     */
    public FortuneLog getDetail(Long id) {
        return fortuneLogMapper.selectById(id);
    }
}
