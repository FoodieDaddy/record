package com.mahjong.score;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@MapperScan("com.mahjong.score.mapper")
public class MahjongScoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(MahjongScoreApplication.class, args);
    }
}
