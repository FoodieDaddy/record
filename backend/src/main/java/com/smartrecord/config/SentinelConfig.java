package com.smartrecord.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

/**
 * Sentinel 限流配置 — URL 维度全局限流 + 资源级规则
 * SentinelResourceAspect 由 spring-cloud-starter-alibaba-sentinel 自动装配
 */
@Configuration
public class SentinelConfig {

    @PostConstruct
    public void initFlowRules() {
        List<FlowRule> rules = new ArrayList<>();

        // 全局接口限流：默认 200 QPS / 资源
        FlowRule apiRule = new FlowRule();
        apiRule.setResource("sentinel_spring_web_context");
        apiRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        apiRule.setCount(200);
        apiRule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_WARM_UP);
        apiRule.setWarmUpPeriodSec(10);
        rules.add(apiRule);

        // 管理员登录接口：5 QPS（严格限制，防止暴力破解）
        FlowRule adminLoginRule = new FlowRule();
        adminLoginRule.setResource("admin-login");
        adminLoginRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        adminLoginRule.setCount(5);
        rules.add(adminLoginRule);

        // 微信登录接口：50 QPS（登录是外部 HTTP 调用，需更严格限制）
        FlowRule loginRule = new FlowRule();
        loginRule.setResource("wx-login");
        loginRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        loginRule.setCount(50);
        loginRule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_WARM_UP);
        loginRule.setWarmUpPeriodSec(5);
        rules.add(loginRule);

        // OSS 预签名：100 QPS
        FlowRule ossRule = new FlowRule();
        ossRule.setResource("oss-presign");
        ossRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        ossRule.setCount(100);
        rules.add(ossRule);

        // TTS 合成：30 QPS（进程调用，资源密集）
        FlowRule ttsRule = new FlowRule();
        ttsRule.setResource("tts-synthesize");
        ttsRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        ttsRule.setCount(30);
        rules.add(ttsRule);

        FlowRuleManager.loadRules(rules);
    }
}
