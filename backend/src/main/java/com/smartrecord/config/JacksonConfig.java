package com.smartrecord.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.format.DateTimeFormatter;

/**
 * Jackson 配置：Long→String 防精度丢失、日期格式统一、忽略未知属性、禁用空 Bean 异常。
 */
@Configuration
public class JacksonConfig {

    private static final String DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    @Bean
    @SuppressWarnings("null")
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> {
            // Long → String，防止 JavaScript 精度丢失
            builder.serializerByType(Long.class, ToStringSerializer.instance);
            builder.serializerByType(Long.TYPE, ToStringSerializer.instance);

            // 日期时间格式统一
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern(DATE_TIME_PATTERN);
            builder.serializers(new LocalDateTimeSerializer(dtf));
            builder.deserializers(new LocalDateTimeDeserializer(dtf));

            // 忽略未知属性（前端多传字段不报错）
            builder.featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
            // 空 Bean 不抛异常（返回 {} 而不是 500）
            builder.featuresToDisable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
            // 日期不序列化为时间戳
            builder.featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        };
    }
}
