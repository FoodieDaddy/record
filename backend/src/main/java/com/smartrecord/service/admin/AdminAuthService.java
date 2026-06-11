package com.smartrecord.service.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.dto.admin.AdminLoginReq;
import com.smartrecord.dto.admin.AdminLoginResp;
import com.smartrecord.entity.Admin;
import com.smartrecord.mapper.AdminMapper;
import com.smartrecord.util.JwtUtil;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 管理员认证服务（含暴力破解防护）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private final AdminMapper adminMapper;
    private final JwtUtil jwtUtil;
    private final SnowflakeIdGenerator idGenerator;

    /** 最大连续登录失败次数，超过后锁定账户 */
    @Value("${app.admin.max-failed-attempts:5}")
    private int maxFailedAttempts;

    /** 账户锁定时长（分钟） */
    @Value("${app.admin.lock-duration-minutes:15}")
    private int lockDurationMinutes;

    /**
     * 管理员登录（含暴力破解防护）
     */
    public AdminLoginResp login(AdminLoginReq req) {
        Admin admin = adminMapper.selectOne(
                new LambdaQueryWrapper<Admin>().eq(Admin::getUsername, req.getUsername())
        );

        if (admin == null) {
            log.warn("管理员登录失败：用户名不存在 username={}", req.getUsername());
            throw new BizException("账号或密码错误");
        }

        // 检查账户是否已被锁定
        if (admin.getLockedUntil() != null && admin.getLockedUntil().isAfter(LocalDateTime.now())) {
            log.warn("管理员登录被拒：账户已锁定 username={}, lockedUntil={}", req.getUsername(), admin.getLockedUntil());
            throw new BizException("账户已被临时锁定，请 " + lockDurationMinutes + " 分钟后重试");
        }

        // 密码校验
        if (!BCrypt.checkpw(req.getPassword(), admin.getPassword())) {
            // 记录失败次数
            int attempts = admin.getFailedAttempts() != null ? admin.getFailedAttempts() + 1 : 1;
            admin.setFailedAttempts(attempts);

            if (attempts >= maxFailedAttempts) {
                // 锁定账户
                admin.setLockedUntil(LocalDateTime.now().plusMinutes(lockDurationMinutes));
                admin.setFailedAttempts(0); // 锁定后重置计数
                log.warn("管理员账户已锁定：username={}, 连续失败{}次", req.getUsername(), attempts);
                adminMapper.updateById(admin);
                throw new BizException("密码连续错误 " + maxFailedAttempts + " 次，账户已锁定 " + lockDurationMinutes + " 分钟");
            }

            adminMapper.updateById(admin);
            log.warn("管理员登录失败：密码错误 username={}, 失败次数={}/{}", req.getUsername(), attempts, maxFailedAttempts);
            throw new BizException("账号或密码错误");
        }

        // 检查账户是否启用
        if (admin.getStatus() != 1) {
            throw new BizException("账号已禁用");
        }

        // 登录成功：清除失败计数和锁定状态
        admin.setFailedAttempts(0);
        admin.setLockedUntil(null);
        admin.setLastLoginAt(LocalDateTime.now());
        adminMapper.updateById(admin);

        String token = jwtUtil.generateToken(admin.getId());

        return AdminLoginResp.builder()
                .token(token)
                .username(admin.getUsername())
                .role(admin.getRole())
                .build();
    }

    /**
     * 创建管理员账号
     */
    public void createAdmin(String username, String password, String role) {
        Long count = adminMapper.selectCount(
                new LambdaQueryWrapper<Admin>().eq(Admin::getUsername, username)
        );
        if (count > 0) {
            throw new BizException("用户名已存在");
        }
        Admin admin = new Admin();
        admin.setId(idGenerator.nextId());
        admin.setUsername(username);
        admin.setPassword(BCrypt.hashpw(password, BCrypt.gensalt()));
        admin.setRole(role);
        admin.setStatus(1);
        admin.setFailedAttempts(0);
        adminMapper.insert(admin);
    }

    /**
     * 管理员修改密码
     */
    public void changePassword(Long adminId, String oldPassword, String newPassword) {
        Admin admin = adminMapper.selectById(adminId);
        if (admin == null) {
            throw new BizException("管理员不存在");
        }
        if (!BCrypt.checkpw(oldPassword, admin.getPassword())) {
            throw new BizException("原密码错误");
        }
        if (newPassword.length() < 8) {
            throw new BizException("新密码长度不能少于 8 位");
        }
        admin.setPassword(BCrypt.hashpw(newPassword, BCrypt.gensalt()));
        adminMapper.updateById(admin);
        log.info("管理员密码已修改: adminId={}, username={}", adminId, admin.getUsername());
    }
}
