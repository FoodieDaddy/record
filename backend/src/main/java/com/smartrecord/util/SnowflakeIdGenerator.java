package com.smartrecord.util;

import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 雪花 ID 生成器
 * 结构: 1位符号位 + 41位时间戳 + 5位数据中心 + 5位工作机器 + 12位序列号
 */
@Component
public class SnowflakeIdGenerator {

    private static final long EPOCH = 1704067200000L; // 2024-01-01 00:00:00
    private static final long DATA_CENTER_ID_BITS = 5L;
    private static final long WORKER_ID_BITS = 5L;
    private static final long SEQUENCE_BITS = 12L;

    private static final long MAX_DATA_CENTER_ID = ~(-1L << DATA_CENTER_ID_BITS);
    private static final long MAX_WORKER_ID = ~(-1L << WORKER_ID_BITS);
    private static final long SEQUENCE_MASK = ~(-1L << SEQUENCE_BITS);

    private static final long WORKER_ID_SHIFT = SEQUENCE_BITS;
    private static final long DATA_CENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;
    private static final long TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATA_CENTER_ID_BITS;

    private final long dataCenterId;
    private final long workerId;
    private final AtomicLong sequence = new AtomicLong(0);
    private volatile long lastTimestamp = -1L;

    public SnowflakeIdGenerator() {
        this.dataCenterId = getDataCenterId();
        this.workerId = getWorkerId();
    }

    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();
        if (timestamp < lastTimestamp) {
            throw new RuntimeException("时钟回拨，拒绝生成 ID");
        }
        if (timestamp == lastTimestamp) {
            long seq = (sequence.incrementAndGet()) & SEQUENCE_MASK;
            if (seq == 0) {
                timestamp = waitNextMillis(lastTimestamp);
            }
        } else {
            sequence.set(0);
        }
        lastTimestamp = timestamp;
        return ((timestamp - EPOCH) << TIMESTAMP_SHIFT)
                | (dataCenterId << DATA_CENTER_ID_SHIFT)
                | (workerId << WORKER_ID_SHIFT)
                | sequence.get();
    }

    private long waitNextMillis(long lastTs) {
        long ts = System.currentTimeMillis();
        while (ts <= lastTs) {
            ts = System.currentTimeMillis();
        }
        return ts;
    }

    private static long getDataCenterId() {
        try {
            byte[] ip = InetAddress.getLocalHost().getAddress();
            return (ip[ip.length - 1] & 0xFF) % (MAX_DATA_CENTER_ID + 1);
        } catch (Exception e) {
            return 1L;
        }
    }

    private static long getWorkerId() {
        try {
            byte[] ip = InetAddress.getLocalHost().getAddress();
            return ((ip[ip.length - 2] & 0xFF) << 8 | (ip[ip.length - 1] & 0xFF)) % (MAX_WORKER_ID + 1);
        } catch (Exception e) {
            return 1L;
        }
    }
}
