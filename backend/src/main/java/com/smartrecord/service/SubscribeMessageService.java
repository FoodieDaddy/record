package com.smartrecord.service;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 微信订阅消息服务
 * 
 * 使用微信订阅消息 API 发送离线通知
 */
@Service
@Slf4j
public class SubscribeMessageService {

    private final StringRedisTemplate redisTemplate;

    @Value("${wechat.appid:}")
    private String appId;

    @Value("${wechat.secret:}")
    private String appSecret;

    /** Redis key 前缀：access_token 缓存 */
    private static final String ACCESS_TOKEN_KEY = "sr:wechat:access_token";

    /** access_token 过期时间（秒），微信默认 7200 秒，这里设 7000 秒提前刷新 */
    private static final int ACCESS_TOKEN_EXPIRE_SECONDS = 7000;

    public SubscribeMessageService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 发送订阅消息
     * 
     * @param openid 接收者的 openid
     * @param templateId 订阅消息模板 ID
     * @param page 点击消息后跳转的页面
     * @param data 模板消息数据
     * @return 是否发送成功
     */
    public boolean sendSubscribeMessage(String openid, String templateId, String page, JSONObject data) {
        try {
            String accessToken = getAccessToken();
            if (accessToken == null) {
                log.error("获取 access_token 失败，无法发送订阅消息");
                return false;
            }

            String url = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=" + accessToken;
            
            JSONObject body = JSONUtil.createObj()
                    .set("touser", openid)
                    .set("template_id", templateId)
                    .set("page", page != null ? page : "pages/room/room")
                    .set("data", data);
            
            String resp = HttpUtil.post(url, body.toString());
            JSONObject respObj = JSONUtil.parseObj(resp);
            
            int errcode = respObj.getInt("errcode", -1);
            if (errcode == 0) {
                log.info("订阅消息发送成功: openid={}, templateId={}", openid, templateId);
                return true;
            } else {
                log.error("订阅消息发送失败: errcode={}, errmsg={}", errcode, respObj.getStr("errmsg"));
                return false;
            }
        } catch (Exception e) {
            log.error("发送订阅消息异常: openid={}, templateId={}", openid, templateId, e);
            return false;
        }
    }

    /**
     * 获取 access_token，优先从 Redis 缓存读取
     */
    private String getAccessToken() {
        String cached = redisTemplate.opsForValue().get(ACCESS_TOKEN_KEY);
        if (cached != null) {
            return cached;
        }

        try {
            String url = String.format(
                    "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
                    appId, appSecret);
            String resp = HttpUtil.get(url);
            JSONObject respObj = JSONUtil.parseObj(resp);
            
            String accessToken = respObj.getStr("access_token");
            if (accessToken == null) {
                log.error("获取 access_token 失败: {}", resp);
                return null;
            }

            // 缓存到 Redis
            redisTemplate.opsForValue().set(ACCESS_TOKEN_KEY, accessToken, ACCESS_TOKEN_EXPIRE_SECONDS, java.util.concurrent.TimeUnit.SECONDS);
            log.info("获取并缓存 access_token 成功");
            return accessToken;
        } catch (Exception e) {
            log.error("获取 access_token 异常", e);
            return null;
        }
    }
}
