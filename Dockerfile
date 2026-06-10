# 使用 Eclipse Temurin JRE 21 Alpine 版本，体积极小
FROM eclipse-temurin:21-jre-alpine

# 安装 TTS 依赖（ffmpeg + edge-tts）
RUN apk add --no-cache ffmpeg python3 py3-pip wget && \
    pip3 install --break-system-packages edge-tts

# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 设置工作目录
WORKDIR /app

# 创建日志目录并赋权
RUN mkdir -p /opt/smartrecord/logs && chown -R appuser:appgroup /opt/smartrecord

# 复制 target 下的 jar 包
COPY --chown=appuser:appgroup backend/target/*.jar app.jar

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 18080

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:18080/api/actuator/health || exit 1

# 启动命令
ENTRYPOINT ["java", "-Xms512m", "-Xmx1024m", "-XX:+UseG1GC", "-jar", "app.jar"]
