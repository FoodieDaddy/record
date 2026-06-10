package com.smartrecord.common;

import lombok.Getter;

/**
 * 业务错误码枚举。
 * 前端可根据 code 值做分支处理。
 */
@Getter
public enum ErrorCode {

    // ── 通用 ──
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录"),
    FORBIDDEN(403, "无权访问"),
    SYSTEM_BUSY(500, "系统繁忙，请稍后重试"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    // ── 身份与接入 ──
    IDENTITY_NOT_FOUND(4001, "终端未接入"),
    IDENTITY_EXPIRED(4001, "接入已过期"),
    IDENTITY_NOT_RECOGNIZED(4001, "身份未识别"),
    ACCOUNT_BANNED(4003, "账号已被封禁"),
    ACCOUNT_LOGGED_OUT(4003, "账号已注销"),
    ROOM_FULL(4003, "空间舰员已满（上限16人）"),

    // ── 空间 ──
    ROOM_NOT_FOUND(400, "空间不存在"),
    ROOM_CLOSED(400, "空间已关闭"),
    ROOM_ARCHIVED(400, "编队已封存"),
    ROOM_ALREADY_JOINED(4009, "你已接入当前空间，无需重复接入"),
    ROOM_MEMBER_NAME_DUPLICATE(4009, "身份重叠：场域内存在同名实体，请前往[我的]修改昵称"),
    ALREADY_HAS_ACTIVE_ROOM(400, "你已有活跃空间，请先退出后再启动"),

    // ── 权限 ──
    NOT_ROOM_MEMBER(400, "您不是该编队成员"),
    NOT_OWNER(400, "仅主控可操作"),
    NOT_OWNER_START_ROUND(400, "仅主控可发起本局录"),
    NOT_OWNER_CANCEL(400, "仅主控可取消"),
    NOT_OWNER_DISSOLVE(400, "仅主控可解散空间"),
    NOT_OWNER_SEAL(400, "仅主控可封存航程"),
    NOT_OWNER_UPDATE_SETTINGS(400, "仅主控可修改记录设置"),
    NOT_OWNER_FILL_SCORE(400, "仅主控可填写"),

    // ── 本局录 ──
    ROUND_ALREADY_PENDING(4101, "当前已有一笔本局录待处理"),
    ROUND_SCORE_ZERO_SUM(4103, "积分变化总和必须为 0"),
    ROUND_EXPIRED(4105, "该录已失效，请刷新空间"),
    ROUND_NOT_FOUND(4105, "没有待处理的录入"),
    ROUND_INVALID_STATE(400, "当前状态不允许填写"),
    ROUND_CONFIRM_INVALID_STATE(400, "当前状态不允许确认"),
    ROUND_FREE_FLOW_NOT_SUPPORTED(400, "自由流转空间不支持本局录"),

    // ── 记分 ──
    SCORE_SELF_TRANSFER(400, "不能给自己计分"),
    SCORE_NOT_ROOM_MEMBER(400, "双方必须都是编队成员"),
    SCORE_ONLY_SELF(400, "请填写自己的积分"),
    SCORE_ONLY_ROOM_MEMBERS(400, "只能记录当前编队内的成员"),
    SCORE_ROOM_ARCHIVED(400, "编队已封存，无法提交"),

    // ── 文件上传 ──
    UNSUPPORTED_FILE_TYPE(400, "不支持的文件类型"),
    FILE_TOO_LARGE(400, "文件不能超过 2MB"),
    MISSING_FILE_SIZE(400, "缺少文件大小"),

    // ── TTS ──
    TTS_TEXT_INVALID(400, "文本无效或过长"),
    TTS_SYNTHESIS_FAILED(400, "语音合成失败"),
    TTS_RESPONSE_WRITE_FAILED(400, "语音响应写入失败"),

    // ── 策略/镜像 ──
    MIRROR_MBTI_ANSWER_COUNT(400, "协议校准需要完成20题"),
    MIRROR_MBTI_INVALID_TYPE(400, "协议类型无效"),

    // ── 用户 ──
    USER_NOT_FOUND(400, "身份未识别，请重新接入终端"),
    ROOM_NO_GENERATE_FAILED(400, "识别码生成失败，请重试"),
    WX_LOGIN_FAILED(400, "微信接入失败"),
    INPUT_CODE_REQUIRED(400, "请输入识别码"),
    SETTINGS_HAS_PENDING_ROUND(400, "当前有待处理录入，不能修改记录设置"),
    SETTINGS_ARCHIVED(400, "空间已封存，不能修改记录设置"),
    ROOM_ALREADY_ARCHIVED(400, "编队已封存，不可重复操作"),
    ROOM_ARCHIVED_OR_FAILED(400, "编队已封存或记录失败"),
    OPERATION_INTERRUPTED(500, "操作被中断");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
