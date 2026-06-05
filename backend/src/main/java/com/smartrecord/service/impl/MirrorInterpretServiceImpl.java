package com.smartrecord.service.impl;

import cn.hutool.http.Header;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smartrecord.dto.mirror.MirrorInterpretation;
import com.smartrecord.dto.mirror.TaibuRunResult;
import com.smartrecord.entity.UserMirrorProfile;
import com.smartrecord.enums.MirrorToolType;
import com.smartrecord.service.MirrorInterpretService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorInterpretServiceImpl implements MirrorInterpretService {

    private final MirrorContentGuard contentGuard;

    @Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    @Value("${app.llm.api-url:}")
    private String apiUrl;

    @Value("${app.llm.api-key:}")
    private String apiKey;

    @Value("${app.llm.model:deepseek-chat}")
    private String model;

    @Override
    public MirrorInterpretation interpret(MirrorToolType toolType, TaibuRunResult taibuResult,
                                          String question, UserMirrorProfile profile) {
        // 如果 taibu 失败，直接使用 fallback
        if (!taibuResult.isSuccess()) {
            return MirrorInterpretFallbackPool.fallback(toolType, profile, taibuResult);
        }

        // 尝试 LLM 解释
        if (apiUrl != null && !apiUrl.isEmpty() && apiKey != null && !apiKey.isEmpty()) {
            try {
                MirrorInterpretation llmResult = CompletableFuture
                        .supplyAsync(() -> callLlm(toolType, taibuResult, question, profile), asyncExecutor)
                        .orTimeout(3000, TimeUnit.MILLISECONDS)
                        .exceptionally(ex -> {
                            log.warn("LLM 解释超时/异常，使用 fallback: {}", ex.getMessage());
                            return MirrorInterpretFallbackPool.fallback(toolType, profile, taibuResult);
                        })
                        .join();

                // 内容安全检查
                MirrorInterpretation fallback = MirrorInterpretFallbackPool.fallback(toolType, profile, taibuResult);
                return contentGuard.sanitize(llmResult, fallback);

            } catch (Exception e) {
                log.warn("LLM 解释异常，使用 fallback: {}", e.getMessage());
                return MirrorInterpretFallbackPool.fallback(toolType, profile, taibuResult);
            }
        } else {
            log.info("LLM 未配置，使用 fallback 解释");
            return MirrorInterpretFallbackPool.fallback(toolType, profile, taibuResult);
        }
    }

    private MirrorInterpretation callLlm(MirrorToolType toolType, TaibuRunResult taibuResult,
                                          String question, UserMirrorProfile profile) {
        String systemPrompt = buildSystemPrompt();
        String userPrompt = buildUserPrompt(toolType, taibuResult, question, profile);

        JSONObject requestBody = new JSONObject();
        requestBody.set("model", model);
        requestBody.set("temperature", 0.6);
        requestBody.set("max_tokens", 2048);
        requestBody.set("include_reasoning", false);

        JSONArray messages = new JSONArray();
        JSONObject systemMsg = new JSONObject();
        systemMsg.set("role", "system");
        systemMsg.set("content", systemPrompt);
        messages.add(systemMsg);

        JSONObject userMsg = new JSONObject();
        userMsg.set("role", "user");
        userMsg.set("content", userPrompt);
        messages.add(userMsg);
        requestBody.set("messages", messages);

        HttpResponse response = HttpRequest.post(apiUrl)
                .header(Header.AUTHORIZATION, "Bearer " + apiKey)
                .header(Header.CONTENT_TYPE, "application/json")
                .body(requestBody.toString())
                .timeout(3000)
                .execute();

        if (!response.isOk()) {
            throw new RuntimeException("LLM API error: " + response.getStatus());
        }

        JSONObject respJson = JSONUtil.parseObj(response.body());
        JSONObject message = respJson.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message");
        String content = message.getStr("content");

        // MiMo 可能将内容放在 reasoning_content 中
        if (content == null || content.isBlank()) {
            content = message.getStr("reasoning_content");
        }
        if (content == null || content.isBlank()) {
            throw new RuntimeException("LLM 返回空内容");
        }

        return parseLlmResponse(content);
    }

    private String buildSystemPrompt() {
        return """
                # Role
                你是 Smart Record 小程序中的「镜像解释引擎」，代号 Oracle-7。
                你不是算命师。你是一个娱乐化、策略化的博弈复盘文案引擎。

                # Context
                Smart Record 是一个线下多人游戏记分工具，用户可能用于麻将、扑克、桌游等场景。

                # Hard Boundaries
                你必须遵守：
                1. 不得声称可以预测真实输赢。
                2. 不得鼓励赌博、借贷、追损、加注、梭哈、扩大真实金钱风险。
                3. 不得使用"必胜、稳赚、发财、转运、保赢"等承诺性表达。
                4. 不得恐吓用户。
                5. 不得要求用户付费改命、转运、化解。
                6. 不得输出传统算命套话。
                7. 不得输出 Markdown。
                8. 只输出严格 JSON。
                9. 语言必须克制、冷静、赛博朋克风。
                10. 每条建议必须能对应输入数据，不要空泛。

                # Style
                - 极简、冷静、低噪声
                - 像一个黑箱策略终端
                - 适合黑底蓝光 UI
                - 不使用 Emoji
                - 不使用玄学恐吓语气

                # Output JSON Schema
                {"title":"结果标题，12字以内","tag":"2-4字状态标签","themeColor":"HEX颜色，只能使用 #0A84FF #5E5CE6 #30D158 #FF9F0A #FF453A 之一","confidence":"LOW | MEDIUM | HIGH","summary":"80-140字。必须融合工具结果、用户问题、MBTI倾向，给出克制的镜像判读。","suggestions":["行动建议1，16字以内","行动建议2，16字以内"],"warnings":["风险预警1，16字以内","风险预警2，16字以内"]}

                只输出 JSON，不要任何其他文字。
                """;
    }

    private String buildUserPrompt(MirrorToolType toolType, TaibuRunResult taibuResult,
                                    String question, UserMirrorProfile profile) {
        JSONObject input = new JSONObject();
        input.set("toolType", toolType.getCode());
        input.set("toolName", toolType.getDisplayName());
        input.set("question", question != null ? question : "");

        if (profile != null && profile.getMbtiType() != null) {
            JSONObject mbti = new JSONObject();
            mbti.set("type", profile.getMbtiType());
            mbti.set("title", profile.getMbtiTitle());
            mbti.set("confidence", profile.getMbtiConfidence());
            input.set("mbti", mbti);
        }

        input.set("taibu", taibuResult.getNormalizedResult());

        return input.toString();
    }

    private MirrorInterpretation parseLlmResponse(String content) {
        try {
            String json = content.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "");
            }
            int start = json.indexOf('{');
            int end = json.lastIndexOf('}');
            if (start >= 0 && end > start) {
                json = json.substring(start, end + 1);
            }

            JSONObject obj = JSONUtil.parseObj(json);
            JSONArray suggestionsArr = obj.getJSONArray("suggestions");
            JSONArray warningsArr = obj.getJSONArray("warnings");

            return MirrorInterpretation.builder()
                    .title(obj.getStr("title", "镜像判读"))
                    .tag(obj.getStr("tag", "参考"))
                    .themeColor(obj.getStr("themeColor", "#0A84FF"))
                    .confidence(obj.getStr("confidence", "LOW"))
                    .summary(obj.getStr("summary", ""))
                    .suggestions(suggestionsArr != null ? suggestionsArr.toList(String.class) : List.of())
                    .warnings(warningsArr != null ? warningsArr.toList(String.class) : List.of())
                    .build();
        } catch (Exception e) {
            log.warn("解析 LLM 解释响应失败: {}", content, e);
            throw new RuntimeException("LLM 响应解析失败", e);
        }
    }
}
