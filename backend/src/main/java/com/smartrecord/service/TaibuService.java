package com.smartrecord.service;

import java.util.List;

public interface TaibuService {

    /** 获取所有可用域名 */
    List<String> getAvailableDomains();

    /**
     * 执行指定域的命理计算
     * @param domain 域名（如 taiyi, bazi, tarot 等）
     * @param inputJson JSON 参数字符串
     * @return 规范文本输出，失败时返回空字符串
     */
    String execute(String domain, String inputJson);

    /** 便捷方法：获取当日太乙九星文本 */
    String getTodayTaiyiText();
}
