# 使用 Eclipse Temurin JRE 17 Alpine 版本，体积极小
FROM eclipse-temurin:17-jre-alpine

# 安装 TTS 依赖（ffmpeg + edge-tts）
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip3 install --break-system-packages edge-tts

# 设置工作目录
WORKDIR /app

# 复制 target 下的 jar 包
COPY backend/target/*.jar app.jar

# 暴露端口
EXPOSE 18080

# 启动命令
ENTRYPOINT ["java", "-Xms512m", "-Xmx1024m", "-XX:+UseG1GC", "-jar", "app.jar"]
