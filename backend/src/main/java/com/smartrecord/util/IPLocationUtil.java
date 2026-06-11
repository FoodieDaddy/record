package com.smartrecord.util;

/**
 * 高性能地理位置解析工具类 (无外部网络依赖，通过 IP 段 Mock 解析)
 */
public class IPLocationUtil {

    public static String parseLocation(String ip) {
        if (ip == null || ip.isEmpty()) {
            return "未知IP";
        }
        if ("127.0.0.1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip) || "localhost".equalsIgnoreCase(ip)) {
            return "本地回环";
        }
        if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
            return "局域网内网";
        }
        if (ip.startsWith("8.8.8.")) {
            return "美国 Google DNS";
        }
        if (ip.startsWith("114.114.114.")) {
            return "中国 江苏 南京";
        }
        // 兜底返回常见国内节点
        return "中国 广东 深圳";
    }
}
