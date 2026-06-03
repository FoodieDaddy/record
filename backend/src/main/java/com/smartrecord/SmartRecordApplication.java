package com.smartrecord;

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
        SpringApplication.run(SmartRecordApplication.class, args);
    }
}
