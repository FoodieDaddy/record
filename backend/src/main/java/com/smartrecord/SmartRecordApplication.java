package com.smartrecord;

import io.github.cdimascio.dotenv.Dotenv;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@MapperScan("com.smartrecord.mapper")
public class SmartRecordApplication {

    public static void main(String[] args) {
        // 本地开发自动加载 .env 文件
        try {
            Dotenv dotenv = Dotenv.configure()
                    .directory("../")
                    .load();
            dotenv.entries().forEach(entry ->
                    System.setProperty(entry.getKey(), entry.getValue())
            );
        } catch (Exception e) {
            // .env 文件不存在时忽略（生产环境通过真实环境变量注入）
        }
        SpringApplication.run(SmartRecordApplication.class, args);
    }
}
