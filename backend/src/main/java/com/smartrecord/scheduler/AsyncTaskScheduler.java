package com.smartrecord.scheduler;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import com.smartrecord.config.OssConfig;
import com.smartrecord.entity.AsyncTask;
import com.smartrecord.service.AsyncTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.concurrent.Executor;

/**
 * 异步任务调度器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AsyncTaskScheduler {

    private final AsyncTaskService asyncTaskService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectProvider<OSS> ossClientProvider;
    private final OssConfig ossConfig;
    private final Executor asyncExecutor;

    @Value("${wechat.appid:}")
    private String appId;

    @Value("${wechat.secret:}")
    private String appSecret;

    /** 每次扫描的任务数量上限 */
    private static final int BATCH_SIZE = 10;


    /** 任务类型：二维码生成 */
    private static final String TASK_TYPE_QR_CODE = "QR_CODE_GENERATE";

    /**
     * 每分钟扫描待执行的二维码生成任务
     */
    @Scheduled(fixedRate = 60000)
    public void processQrCodeTasks() {
        List<AsyncTask> tasks = asyncTaskService.fetchPendingTasks(TASK_TYPE_QR_CODE, BATCH_SIZE);
        if (tasks.isEmpty()) {
            return;
        }

        log.info("扫描到 {} 个待执行的二维码生成任务", tasks.size());
        for (AsyncTask task : tasks) {
            if (asyncTaskService.startTask(task.getId())) {
                asyncExecutor.execute(() -> processQrCodeTask(task));
            }
        }
    }

    /**
     * 处理单个二维码生成任务
     */
    private void processQrCodeTask(AsyncTask task) {
        try {
            JSONObject payload = JSONUtil.parseObj(task.getPayload());
            String roomNo = payload.getStr("roomNo");
            String roomId = payload.getStr("roomId");
            if (roomNo == null) {
                asyncTaskService.markFailed(task.getId(), "payload 中缺少 roomNo 字段");
                return;
            }

            String url = generateQrCode(roomNo);
            if (url != null) {
                // 写入房间 data Hash 的 qr 字段
                if (roomId != null) {
                    String dataKey = "sr:room:" + roomId + ":data";
                    redisTemplate.opsForHash().put(dataKey, "qr", url);
                }
                asyncTaskService.markSuccess(task.getId());
                log.info("二维码生成任务完成: roomNo={}, roomId={}", roomNo, roomId);
            } else {
                asyncTaskService.markFailed(task.getId(), "二维码生成返回空 URL");
            }
        } catch (Exception e) {
            log.error("处理二维码生成任务异常: taskId={}", task.getId(), e);
            asyncTaskService.markFailed(task.getId(), e.getMessage());
        }
    }

    /**
     * 生成小程序码并上传到 OSS，返回访问 URL
     */
    private String generateQrCode(String roomNo) {
        try {
            // 获取 access_token
            String tokenUrl = String.format(
                    "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
                    appId, appSecret);
            String tokenResp = HttpUtil.get(tokenUrl);
            String accessToken = JSONUtil.parseObj(tokenResp).getStr("access_token");
            if (accessToken == null) {
                log.error("获取 access_token 失败: {}", tokenResp);
                return null;
            }

            // 调用微信接口生成小程序码
            String qrUrl = "https://api.weixin.qq.com/wxa/getunlimited?access_token=" + accessToken;
            JSONObject body = JSONUtil.createObj()
                    .set("scene", roomNo)
                    .set("page", "pages/room/room")
                    .set("width", 280);
            byte[] qrBytes = HttpUtil.createPost(qrUrl)
                    .body(body.toString(), "application/json")
                    .execute()
                    .bodyBytes();

            // 上传到 OSS
            String objectKey = "qrcode/" + roomNo + ".png";
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType("image/png");
            PutObjectRequest putRequest = new PutObjectRequest(
                    ossConfig.getBucketName(), objectKey,
                    new ByteArrayInputStream(qrBytes), metadata);
            OSS client = ossClientProvider.getIfAvailable();
            if (client != null) {
                client.putObject(putRequest);
            } else {
                log.info("OSS client not configured, skipping QR code upload.");
            }

            return "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/" + objectKey;
        } catch (Exception e) {
            log.error("生成小程序码失败", e);
            return null;
        }
    }
}
