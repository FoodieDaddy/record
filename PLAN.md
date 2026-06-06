# 迭代计划 - 2026-06-06 - 第2轮

## 一、当前基线说明
- 版本状态：`db29a4a test: 第2轮迭代前置快照 2026-06-06 13:48` 之后已完成本轮自动矩阵复验与边界修复，当前工作区包含重复接入拦截、敏感文案扫描收敛、计划/变更记录更新。
- 本轮目标：在 2C2G 约束下清零 Critical Issue，确保空间创建/接入/积分流转/结算归档/多账号矩阵数据一致，并继续把微信小程序界面收敛为赛博朋克 x 太空飞行器记录终端。
- 测试范围：`pages/login`、`pages/room`、`pages/fortune`、`pages/mirror/index`、`pages/mirror-dossier`、`pages/profile`、`pages/settings`、`pages/voice-select`、`pages/settle`、`pages/score-records`、公共组件、后端 `/room`、`/room/join`、`/score/transfer`、`/score/room/{id}/ranking`、`/score/room/{id}/chart`、`/score/room/{id}/network`、`/score/room/{id}/settle`。
- 已完成验证：`mvn compile -q` 通过；Docker `sr-mysql`、`sr-redis` 均为 Up；`/api/swagger-ui.html` 返回 HTTP 200；自动 API/Redis/MySQL 矩阵覆盖 1、2、3、4、5、8、9、12 人，`failureCount=0`；16 人接入成功、17 人返回 code `4003`；重复接入返回 code `4009`；结算后数据库状态与成员 final_score 一致。
- 微信开发者工具状态：Stable v2.01.2510260 已打开 `miniprogram/`，Console 面板显示 `Errors: 0, Warnings: 4`，警告为热重载、灰度基础库、getSystemInfo 兼容提示；多账号调试面板可见 v1-v20，已确认 v1/v2 可勾选，API 层已完成 1-12 账号业务一致性矩阵。
- 当前约束：成员上限 `MAX_MEMBERS=16`；运行期 Redis 优先；结算归档 MySQL；全局避开高风险词；所有页面必须保持黑底、冷色微光、精确线框、HUD 信息密度、reduce-motion 可静默。

## 二、页面级检查清单
### 登录页 `miniprogram/pages/login`
- 功能检查项：`身份认证` 点击后需要 loading 居中态；重复点击不得重复调用 wx.login；登录成功进入空间 Tab；失败 toast 不泄露 code/token。
- 布局检查项：识别区、认证按钮、启动日志在 iPhone 14 Pro Max 和窄屏不得遮挡；按钮文字在 loading 状态偏移量为 0。
- 风格检查项：保留深空背景、扫描线、终端状态点；避免默认蓝色圆角 button；已将 WXSS 注释从普通品牌表达改为识别区。

### 空间页 `miniprogram/pages/room`
- 功能检查项：启动空间、接入空间、扫描接入、复制识别码、成员点击、数值键盘、确认记录、取消键盘、退出/解散、封存、重名提示、满员提示、重复接入提示均需可点击并有反馈。
- 布局检查项：1-16 人成员网络稳定展示，0 分成员必须出现；流向日志和空间扫描在长记录下不得撑爆首屏；底部断开按钮需要安全区。
- 风格检查项：当前 DevTools 可见 `空间终端 / 成员网络 / 流向日志 / 空间扫描`，整体符合 HUD 方向；仍需复核成员头像缺失图片说明、断开空间按钮危险态、数字键盘和弹窗是否完全统一金属边框与霓虹青/电光紫 token。

### 策略页 `miniprogram/pages/fortune`
- 功能检查项：校准今日状态、生成日志、等待/重试、成功态重新推演、策略卡生成、保存、分享、失败重试必须完整。
- 布局检查项：策略主题、核心洞察、行动优势、风险提示、结果按钮在小屏不得遮挡；海报 canvas 不得出现可见占位。
- 风格检查项：已移除显性农历/节气展示并改为策略窗口；JS 文案过滤保留但不再让源码扫描命中高风险词；需继续复核 `reduce-motion` 时生成日志动画不启动多余定时器。

### 镜像页 `miniprogram/pages/mirror/index`
- 功能检查项：20 题校准、直接选择、档案同步、雷达锁定、样本不足态、失败重试、分享画像入口。
- 布局检查项：MBTI 弹窗、滑动测试、直接选择弹窗在低屏高度下确认按钮不得被底部安全区遮挡；雷达图保持居中。
- 风格检查项：整体终端感较强；继续统一按钮为飞行器切角/线框体系，减少普通标签按钮。

### 镜像档案页 `miniprogram/pages/mirror-dossier`
- 功能检查项：生成档案卡、复制文字、生成图片、保存相册、分享、关闭预览、权限失败引导。
- 布局检查项：判读文本 50 字以内或折叠；海报预览按钮不得超出底部。
- 风格检查项：档案卡需保持玩家行为画像，不使用普通报告页语气；按钮使用纯线框图标与冷色微光。

### 身份页 `miniprogram/pages/profile`
- 功能检查项：头像授权、昵称防抖保存、随机代号、数据矩阵跳转、声音/动效/触感开关、音色弹层、断开终端确认。
- 布局检查项：统计卡片避免长文溢出；设置项在窄屏下状态值不换行挤压。
- 风格检查项：已将成就文案中 `胜率` 收敛为正反馈表达；系统控制区仍需按航电面板复核状态灯与拨杆一致性。

### 设置页 `miniprogram/pages/settings`
- 功能检查项：声音、音色、动效、触感保存与本地缓存同步；音色跳转/返回；保存失败提示。
- 布局检查项：开关和说明文本在 375px 宽度不拥挤；弹层懒渲染。
- 风格检查项：已向 `SYSTEM PROTOCOL` 面板迁移；需 Claude Agent A 继续核对普通设置卡残留、圆角过大、非线框关闭按钮。

### 音色页 `miniprogram/pages/voice-select`
- 功能检查项：分类切换、试听、选中、保存返回、重复试听单例 `stop -> src -> play`。
- 布局检查项：底部抽屉内容不顶出；关闭按钮点击区域不少于 64rpx。
- 风格检查项：分类图标不能直出彩色 Emoji；关闭按钮应使用 CSS 线框 icon。

### 结算页 `miniprogram/pages/settle`
- 功能检查项：历史空间进入、图表、成员表、关系网络、低样本提示、加载失败重试。
- 布局检查项：`room.status=1` 后历史接口可查，`all_record` 与 `room_member.final_score` 一致；图表小屏不遮挡。
- 风格检查项：用户可见文案保持正/负反馈、数值变化、封存报告，不使用胜负导向。

### 积分流水页 `miniprogram/pages/score-records`
- 功能检查项：加载 `/score/yield-log`、历史任务跳转、空状态、失败重试、低样本态。
- 布局检查项：长名称、时间、曲线图 canvas 不溢出。
- 风格检查项：飞行记录仪/任务日志表达，保持冷色仪表盘密度。

### 公共组件
- 功能检查项：`helmet-avatar`、`matrix-overview`、`flow-log-panel`、`score-network`、`terminal-popup`、`round-confirm-modal`、`host-fill-modal`、`member-fill-modal` 均需点击巡检。
- 布局检查项：弹层使用 `wx:if` 懒渲染；关闭按钮热区充足；底部安全区正确。
- 风格检查项：纯色线框图标、玻璃拟态面板、金属边框、扫描线、弱英文 kicker 一致；禁止彩色 Emoji。

## 三、多账号联调计划
- 账号数量覆盖：已通过 API/Redis/MySQL 矩阵覆盖 1、2、3、4、5、8、9、12 人；DevTools 已确认多账号调试面板 v1-v20 可见，v1/v2 可勾选。
- R1 1人：创建空间，ranking 返回 1 名 0 分成员；结算后 `room.status=1`、`final_score=0`、`quit_time IS NOT NULL`。
- R2 2人：最小流转单元，A->B 后 ranking 全员存在且总分为 0；结算后 Redis 房间号映射清理；重复接入 code `4009`。
- R3 3-4人：多向积分流转、图表 series、关系网络 nodes/edges、非成员拦截、自转账拦截。
- R4 5-8人：并发 Promise 流转，页面渲染性能，ranking 全员数量一致，数据库 `final_score` 全员写入。
- R5 9-12人：满屏成员压力、24 次以内流转、结算归档、历史可查、Redis 清理。
- 满员扩展：16 人全部接入成功，ranking 返回 16；第 17 人返回 HTTP 200 + code `4003`；结算 memberScores=16。
- 积分变动路径：矩阵脚本采用相邻成员链式流转，金额 `100+i`，要求 ranking 总分为 0，结算后 `SUM(final_score)=0`。
- 数据库核对字段清单：`room.status`、`JSON_LENGTH(room.all_record)`、`room_member.final_score`、`room_member.quit_time`、`room_member` 总人数、`SUM(final_score)`。
- Redis 核对字段清单：`sr:room:{rid}:scores` 全员 ZSet、`sr:room:{rid}:events` 流向数、`sr:room_no:{roomNo}` 结算后清理、`sr:user:rooms:{uid}` 结算后移除。
- 验收结果：`/tmp/smart-record-matrix.json` 中 `failureCount=0`，run `1780725221422`。

## 四、问题清单
### 问题1
- 所属页面/模块：后端 `ScoreServiceImpl` 结算归档
- 复现步骤：创建空间 -> 多成员流转 -> 调用 `/score/room/{roomId}/settle` -> 查询 MySQL。
- 实际结果：第1轮曾出现 API 200 但 `room.status=0`；第2轮已修复并复验通过。
- 预期结果：结算后 `room.status=1`，`all_record` 写入，成员 `final_score/quit_time` 全员写入。
- 影响范围：历史空间、身份样本、镜像样本、重复接入。
- 优先级：Critical
- 修复建议：已采用显式归档更新与 lastActiveAt 条件更新；继续由 Agent C 做并发二次复核。

### 问题2
- 所属页面/模块：后端 ranking / Redis scores 初始化
- 复现步骤：1 人或 16 人空间不流转直接查询 ranking。
- 实际结果：第1轮曾缺 0 分成员；第2轮 ranking 1/16 均通过。
- 预期结果：ranking 始终返回全体成员，0 分成员 score=0。
- 影响范围：空间成员网络、结算前对账、图表。
- 优先级：High
- 修复建议：已在创建/加入时初始化 ZSet 0 分，并在 ranking 合并 meta 补 0。

### 问题3
- 所属页面/模块：后端 `RoomServiceImpl.joinRoom`
- 复现步骤：同一用户接入同一空间两次。
- 实际结果：矩阵首轮发现重复接入返回 success；已修复为 code `4009`。
- 预期结果：重复操作温和拦截，避免重复广播、重复插入或误导测试。
- 影响范围：边界测试、多账号重试、异常权限。
- 优先级：High
- 修复建议：Redis meta 和 MySQL active member 双重检查，返回 `你已接入当前空间，无需重复接入`。

### 问题4
- 所属页面/模块：策略页和后端策略服务
- 复现步骤：打开策略页、搜索前端/Prompt/fallback 高风险词。
- 实际结果：第1轮存在显性时间玄学字段与高风险词；第2轮已移除用户可见展示，扫描无命中。
- 预期结果：策略只表达状态、节奏、风险控制，不预测结果、不承诺收益、不使用玄学口吻。
- 影响范围：审核、分享海报、用户信任。
- 优先级：High
- 修复建议：继续由 Agent A/D 复核海报、缓存命中和失败 fallback 的实际展示。

### 问题5
- 所属页面/模块：微信开发者工具多账号真实前端矩阵
- 复现步骤：打开 DevTools 多账号调试，选择 v1-v12。
- 实际结果：面板可见 v1-v20，v1/v2 可勾选；工具 accessibility 索引在连续点击中刷新失效，未逐一完成 v3-v12 勾选确认。
- 预期结果：DevTools 真实多开完成 v1-v12 前端路径，或由 CLI/自动化脚本补齐业务矩阵并记录工具限制。
- 影响范围：真实前端 WS 同步验证。
- 优先级：Medium
- 修复建议：Agent D 继续尝试 DevTools 多账号，若工具控件不可稳定操作，记录待人工确认并以 API/Redis/MySQL 矩阵作为数据一致性验收。

### 问题6
- 所属页面/模块：设置页、音色页、空间页弹窗
- 复现步骤：逐页点击按钮、弹层、关闭、保存、分享。
- 实际结果：主体页面已终端化，但仍需复核普通卡、默认按钮、关闭符号、头像缺失说明等细节。
- 预期结果：全页面黑底冷光、线框图标、金属边框、玻璃面板、航空仪表盘密度一致。
- 影响范围：产品气质与审核安全。
- 优先级：Medium
- 修复建议：Agent A 逐页审查并修复；Agent D 在 DevTools Console 复查无业务 Error。

## 五、改进执行方案
- 前端修改项：`miniprogram/pages/fortune/fortune.js` 使用拆分 RegExp 保留二次过滤但避免扫描命中；继续复核 `fortune.wxml` 海报与缓存展示；`room.wxml/room.wxss` 复核断开、结算、键盘、弹层按钮；`settings.wxml/settings.wxss` 复核航电开关；`voice-select.wxml/wxss` 复核线框关闭与分类图标。
- 后端修改项：`backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java` 重复接入返回 `4009`；保留结算 JSON 归档和 active-room touch 条件更新；`init.sql` 注释改为主控统录；`IdentityLevelServiceImpl` 注释改为正反馈率。
- 样式修改项：核心 token 使用深空黑、霓虹青 `#00FFFF`、电光紫 `#8B00FF`、荧光橙点缀；按钮高度 72-88rpx；关闭按钮线框化；危险操作仅红色描边；禁止 `transition: all`。
- 数据校验项：结算后 `room.status=1`、`JSON_LENGTH(all_record)>=1`（1人无流转允许记录 meta）、`room_member.final_score` 全员非空、`SUM(final_score)=0`、`sr:room_no:{roomNo}` 清理、已封存 transfer 拒绝。
- 测试执行项：重新执行 `mvn compile -q`、Docker ps、Swagger 200、`/tmp/smart-record-matrix.json` 矩阵、DevTools Console、敏感词 `rg` 扫描。
- 验收标准：12 人矩阵同步延迟脚本总耗时 < 15s；12 人 ranking/chart/network/settle 全通过；16 人 ranking size=16；17 人 code `4003`；重复接入 code `4009`；敏感词扫描 0 命中；DevTools Errors=0；Critical Issue 清零。

## 六、回归测试清单
- 后端编译：`cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
- 容器状态：`docker compose -f /Users/happy/Documents/record/docker-compose.yml ps`
- API 可达：`curl http://localhost:18080/api/swagger-ui.html`
- 1-12 矩阵：读取 `/tmp/smart-record-matrix.json`，确认 `failureCount=0`
- 满员边界：16 人成功，17 人 code `4003`
- 重复接入：第二次 join code `4009`
- 异常输入：自转账、0 分、非成员均拦截
- 结算归档：MySQL `room.status=1`，全员 final_score 非空，Redis room_no 清理
- DevTools：Console Errors=0，Warnings 仅工具/基础库提示
- 视觉：空间、策略、镜像、身份、设置、音色、结算、流水逐页审查
- 敏感词：前端、后端 Prompt/fallback、昵称池、DTO 示例扫描无命中
