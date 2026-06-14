package com.smartrecord;

import com.smartrecord.scheduler.AsyncTaskScheduler;
import com.smartrecord.task.RoomTimeoutTask;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 集成冒烟测试 — 验证 Spring 上下文、Actuator、数据库、Redis 连通性。
 * 需要 docker-compose 的 MySQL + Redis 在运行。
 * 运行方式：mvn test -Dgroups=integration
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Tag("integration")
class IntegrationSmokeTest {

    @MockBean
    private RoomTimeoutTask roomTimeoutTask;

    @MockBean
    private AsyncTaskScheduler asyncTaskScheduler;

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Actuator health 端点返回 UP")
    void actuatorHealthShouldBeUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Actuator info 端点可访问")
    void actuatorInfoShouldBeAccessible() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("未登录请求返回 401")
    void unauthenticatedRequestShouldReturn401() throws Exception {
        mockMvc.perform(get("/user/info"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Swagger UI 在非生产环境可访问")
    void swaggerUiShouldBeAccessibleInDev() throws Exception {
        mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().is3xxRedirection());
    }
}
