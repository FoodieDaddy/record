package com.smartrecord.config;

import com.smartrecord.mapper.AdminMapper;
import com.smartrecord.service.admin.AdminAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminDataSeeder implements CommandLineRunner {

    private final AdminMapper adminMapper;
    private final AdminAuthService adminAuthService;

    @Value("${admin.default.password:admin123}")
    private String defaultPassword;

    @Override
    public void run(String... args) {
        Long count = adminMapper.selectCount(null);
        if (count == 0) {
            log.info("管理员表为空，创建默认管理员账号");
            adminAuthService.createAdmin("admin", defaultPassword, "SUPER_ADMIN");
            log.info("默认管理员创建完成，请尽快修改初始密码");
        }
    }
}
