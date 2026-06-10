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
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 管理员认证服务
 */
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private final AdminMapper adminMapper;
    private final JwtUtil jwtUtil;
    private final SnowflakeIdGenerator idGenerator;

    /**
     * 管理员登录
     */
    public AdminLoginResp login(AdminLoginReq req) {
        Admin admin = adminMapper.selectOne(
                new LambdaQueryWrapper<Admin>().eq(Admin::getUsername, req.getUsername())
        );
        if (admin == null || !BCrypt.checkpw(req.getPassword(), admin.getPassword())) {
            throw new BizException("账号或密码错误");
        }
        if (admin.getStatus() != 1) {
            throw new BizException("账号已禁用");
        }

        String token = jwtUtil.generateToken(admin.getId());

        admin.setLastLoginAt(LocalDateTime.now());
        adminMapper.updateById(admin);

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
        adminMapper.insert(admin);
    }
}
