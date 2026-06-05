package com.smartrecord.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smartrecord.common.BizException;
import com.smartrecord.common.PageResult;
import com.smartrecord.dto.mirror.MirrorArchiveItem;
import com.smartrecord.dto.mirror.MirrorInterpretation;
import com.smartrecord.dto.mirror.MirrorReportResp;
import com.smartrecord.entity.MirrorReport;
import com.smartrecord.enums.MirrorToolType;
import com.smartrecord.mapper.MirrorReportMapper;
import com.smartrecord.service.MirrorReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorReportServiceImpl implements MirrorReportService {

    private final MirrorReportMapper reportMapper;

    @Override
    public void saveReport(MirrorReport report) {
        reportMapper.insert(report);
    }

    @Override
    public MirrorReportResp getReport(Long userId, Long reportId) {
        MirrorReport report = reportMapper.selectById(reportId);
        if (report == null || !report.getUserId().equals(userId)) {
            throw new BizException("报告不存在");
        }
        return toReportResp(report);
    }

    @Override
    public PageResult<MirrorArchiveItem> getArchive(Long userId, int page, int pageSize, String category) {
        LambdaQueryWrapper<MirrorReport> wrapper = new LambdaQueryWrapper<MirrorReport>()
                .eq(MirrorReport::getUserId, userId)
                .orderByDesc(MirrorReport::getCreatedAt);

        if (category != null && !category.isEmpty()) {
            List<String> toolCodes = getToolCodesByCategory(category);
            if (!toolCodes.isEmpty()) {
                wrapper.in(MirrorReport::getToolType, toolCodes);
            }
        }

        Page<MirrorReport> result = reportMapper.selectPage(new Page<>(page, pageSize), wrapper);
        List<MirrorArchiveItem> items = result.getRecords().stream()
                .map(this::toArchiveItem)
                .toList();

        return PageResult.of(result.getTotal(), items);
    }

    @Override
    public List<MirrorReport> getRecentReports(Long userId, int limit) {
        return reportMapper.selectList(new LambdaQueryWrapper<MirrorReport>()
                .eq(MirrorReport::getUserId, userId)
                .orderByDesc(MirrorReport::getCreatedAt)
                .last("LIMIT " + limit));
    }

    private MirrorReportResp toReportResp(MirrorReport r) {
        MirrorInterpretation interp = null;
        if (r.getInterpretation() != null) {
            Map<String, Object> m = r.getInterpretation();
            interp = MirrorInterpretation.builder()
                    .title((String) m.get("title"))
                    .tag((String) m.get("tag"))
                    .themeColor((String) m.get("themeColor"))
                    .confidence((String) m.get("confidence"))
                    .summary((String) m.get("summary"))
                    .warnings(r.getWarnings())
                    .suggestions(r.getSuggestions())
                    .build();
        }

        MirrorToolType toolType;
        try {
            toolType = MirrorToolType.fromCode(r.getToolType());
        } catch (Exception e) {
            toolType = null;
        }

        return MirrorReportResp.builder()
                .id(r.getId())
                .toolType(r.getToolType())
                .toolName(toolType != null ? toolType.getDisplayName() : r.getToolType())
                .title(r.getTitle())
                .tag(r.getTag())
                .themeColor(r.getThemeColor())
                .question(r.getQuestion())
                .normalizedResult(r.getNormalizedResult())
                .interpretation(interp)
                .summary(r.getSummary())
                .suggestions(r.getSuggestions())
                .warnings(r.getWarnings())
                .source(r.getSource())
                .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : null)
                .mbtiSnapshot(r.getMbtiSnapshot())
                .rawResult(r.getRawResult())
                .build();
    }

    private MirrorArchiveItem toArchiveItem(MirrorReport r) {
        MirrorToolType toolType;
        try {
            toolType = MirrorToolType.fromCode(r.getToolType());
        } catch (Exception e) {
            toolType = null;
        }

        String questionBrief = r.getQuestion();
        if (questionBrief != null && questionBrief.length() > 20) {
            questionBrief = questionBrief.substring(0, 20) + "...";
        }

        return MirrorArchiveItem.builder()
                .id(r.getId())
                .toolType(r.getToolType())
                .toolName(toolType != null ? toolType.getDisplayName() : r.getToolType())
                .title(r.getTitle())
                .tag(r.getTag())
                .questionBrief(questionBrief)
                .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : null)
                .timeText(formatTimeText(r.getCreatedAt()))
                .category(toolType != null ? toolType.getCategory() : "")
                .build();
    }

    private String formatTimeText(LocalDateTime dateTime) {
        if (dateTime == null) return "";
        long minutes = ChronoUnit.MINUTES.between(dateTime, LocalDateTime.now());
        if (minutes < 1) return "刚刚";
        if (minutes < 60) return minutes + "分钟前";
        long hours = ChronoUnit.HOURS.between(dateTime, LocalDateTime.now());
        if (hours < 24) return hours + "小时前";
        long days = ChronoUnit.DAYS.between(dateTime, LocalDateTime.now());
        if (days < 30) return days + "天前";
        return dateTime.format(DateTimeFormatter.ofPattern("MM-dd"));
    }

    private List<String> getToolCodesByCategory(String category) {
        return java.util.Arrays.stream(MirrorToolType.values())
                .filter(t -> t.getCategory().equalsIgnoreCase(category))
                .map(MirrorToolType::getCode)
                .toList();
    }
}
