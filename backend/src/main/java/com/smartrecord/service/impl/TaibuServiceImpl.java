package com.smartrecord.service.impl;

import com.smartrecord.service.TaibuService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class TaibuServiceImpl implements TaibuService {

    /** 可用域列表（排除 astrology，依赖 Node.js CJS 模块） */
    private static final List<String> DOMAINS = List.of(
            "almanac", "bazi", "bazi-dayun", "bazi-pillars-resolve",
            "daliuren", "liuyao", "meihua", "qimen",
            "taiyi", "tarot", "xiaoliuren",
            "ziwei", "ziwei-flying-star", "ziwei-horoscope"
    );

    /** 预编译的 JS Source 缓存（按需加载） */
    private final Map<String, Source> sourceCache = new ConcurrentHashMap<>();

    @Override
    public List<String> getAvailableDomains() {
        return DOMAINS;
    }

    @Override
    public String execute(String domain, String inputJson) {
        if (!DOMAINS.contains(domain)) {
            return "{\"error\":\"未知域: " + domain + "\"}";
        }
        try {
            Source source = getOrLoadSource(domain);
            if (source == null) {
                return "{\"error\":\"域 " + domain + " 的 JS 模块未找到\"}";
            }

            String funcName = "taibu_" + domain.replace("-", "_");

            try (Context ctx = Context.newBuilder("js")
                    .allowAllAccess(true)
                    .build()) {
                ctx.eval(source);
                Value fn = ctx.getBindings("js").getMember(funcName);
                if (fn == null || fn.isNull()) {
                    return "{\"error\":\"函数 " + funcName + " 未找到\"}";
                }

                Value result = fn.execute(inputJson);
                return result.asString();
            }
        } catch (Exception e) {
            log.warn("太乙 [{}] 执行失败", domain, e);
            return "{\"error\":\"" + domain + " 计算失败: " + e.getMessage() + "\"}";
        }
    }

    @Override
    public String getTodayTaiyiText() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        String inputJson = String.format(
                "{\"mode\":\"day\",\"date\":\"%s\",\"hour\":%d,\"minute\":%d}",
                today.toString(), now.getHour(), now.getMinute());
        return execute("taiyi", inputJson);
    }

    /** 按需加载并缓存域的 JS Source */
    private Source getOrLoadSource(String domain) {
        return sourceCache.computeIfAbsent(domain, d -> {
            String path = "/taibu/" + d + ".js";
            try (InputStream is = getClass().getResourceAsStream(path)) {
                if (is == null) {
                    log.warn("taibu 资源未找到: {}", path);
                    return null;
                }
                Source source = Source.newBuilder("js", new InputStreamReader(is), d + ".js").build();
                log.info("太乙域 [{}] JS 预编译完成", d);
                return source;
            } catch (Exception e) {
                log.warn("太乙域 [{}] JS 预编译失败", d, e);
                return null;
            }
        });
    }
}
