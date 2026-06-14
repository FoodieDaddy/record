package com.smartrecord.service;

import com.smartrecord.common.BizException;
import com.smartrecord.dto.user.LoginReq;
import com.smartrecord.scheduler.AsyncTaskScheduler;
import com.smartrecord.task.RoomTimeoutTask;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * UserService 集成测试 — 使用真实 MySQL + Redis 验证核心链路。
 * 运行方式：mvn test -Dgroups=integration
 */
@SpringBootTest
@ActiveProfiles("local")
@Tag("integration")
class UserServiceIntegrationTest {

    @MockBean
    private RoomTimeoutTask roomTimeoutTask;

    @MockBean
    private AsyncTaskScheduler asyncTaskScheduler;

    @Autowired
    private UserService userService;

    @Test
    @DisplayName("无效微信 code 应抛出 BizException")
    void loginWithInvalidCodeShouldThrow() {
        LoginReq req = new LoginReq();
        req.setCode("invalid_code_for_test");
        assertThrows(BizException.class, () -> userService.login(req));
    }
}
