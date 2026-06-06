# 迭代计划 - 2026-06-06 - 第1轮

## 一、当前基线说明
- 版本状态：`bc6bfe2 test: 第1轮迭代补充基线 2026-06-06 13:10`，后端 Java 21 编译已通过，Docker MySQL/Redis 与后端 `18080` 均可访问，微信开发者工具 Stable v2.01.2510260 已打开 `miniprogram/` 项目。
- 本轮目标：修复结算归档、排行榜完整性、审核敏感词、DevTools timeout 与页面风格不一致问题；把主流程统一收敛为「赛博朋克 x 太空飞行器」记录终端体验。
- 测试范围：`pages/login`、`pages/room`、`pages/fortune`、`pages/mirror/index`、`pages/mirror-dossier`、`pages/profile`、`pages/settings`、`pages/voice-select`、`pages/settle`、`pages/score-records`；后端 `/room`、`/room/join`、`/score/transfer`、`/score/room/{id}/ranking`、`/score/room/{id}/settle`、`/fortune/today`、`/user/*`、`/mirror/*`。
- 已完成测试事实：自动 API/Redis/MySQL 矩阵覆盖 1、2、4、8、12 人；边界脚本覆盖 16 人满员、17 人拦截、自转账、0/负数积分、非成员积分、重复昵称、成员退出、房主解散；DevTools 可见多账号虚拟测试账号 v1-v20，Console 当前 `1 error, 6 warnings`，真实错误为 `Error: timeout`。
- 当前约束：成员上限 16；运行期分数与成员元信息优先 Redis；所有按钮、弹层、设置、分享、策略、昵称和后端 DTO 示例必须避开高风险词与普通表单风；所有动效必须受 `animationEnabled` / `reduce-motion` 约束。

## 二、页面级检查清单
### 登录页 `miniprogram/pages/login/login.*`
- 功能检查项：点击「身份认证」必须有 loading 静态居中态；重复点击不得重复触发 wx.login；登录成功必须 `switchTab('/pages/room/room')`；登录失败必须短提示且不泄露微信 code。
- 布局检查项：iPhone 14 Pro Max 与窄屏下系统状态卡、认证按钮、底部安全距离不得遮挡；加载步骤文字不得撑破按钮。
- 风格检查项：保留黑底、蓝光、终端状态条；按钮使用切角/描边飞行器风格；禁止普通蓝色大圆角按钮。

### 空间页 `miniprogram/pages/room/room.*`
- 功能检查项：创建空间、接入空间、扫码接入、最近空间、复制识别码、分享面板、成员点击、数值键盘、确认记录、取消键盘、Mode 2 发起本局录入、成员自填、主控统录、确认/驳回、封存二次确认、退出/解散、重名提示、满员提示均需可点击并有反馈。
- 布局检查项：成员 1-16 人必须稳定显示；进行中排行榜必须包含所有成员，包括 0 分成员；键盘底部安全区不得遮挡确认按钮；分享面板与结算弹层必须 `wx:if` 或等价懒渲染，打开后禁止背景滚动。
- 风格检查项：当前空间页可见「空间终端」「成员网络」「流向日志」「空间扫描」已接近飞行器 HUD；仍需统一 `btn-primary`、二维码/分享/结算/重名弹窗、数字键盘和 Mode 2 弹窗为金属边框、霓虹青 `#00FFFF`、电光紫 `#8B00FF`、深空黑、荧光橙点缀的仪表盘语言。

### 策略页 `miniprogram/pages/fortune/fortune.*`
- 功能检查项：空闲态点击「校准今日状态」进入生成；5 秒显示等待提示，10 秒显示继续等待/重新推演；成功态重新推演弹窗、策略卡生成、保存图片、分享微信、关闭、失败重试必须完整；同日缓存需能命中。
- 布局检查项：策略主题、核心洞察、行动优势、风险提示、结果按钮、倒计时在小屏不得遮挡；海报 canvas 不得可见占位；生成态动画在 `reduce-motion` 时必须静默。
- 风格检查项：DevTools 可见页面仍展示 `丙午年四月廿一`、`小满充能`、农历/节气信息。该信息与「非玄学策略终端」边界冲突，需改为隐藏或映射为「时间窗口 / 节奏窗口 / WINDOW」，后端 Prompt 不得要求“必须引用节气/农历意象”。

### 镜像页 `miniprogram/pages/mirror/index.*`
- 功能检查项：20 题校准、直接选择、关闭确认、同步成功/失败、生成档案、雷达锁定、样本进度、人格偏差与系统判读均需测试；未登录或接口失败需进入可恢复空状态。
- 布局检查项：MBTI 弹窗、滑动测试、直接选择弹窗在 iPhone 14 Pro Max 与低屏高度下不得遮挡确认按钮；雷达图 480rpx 在窄屏需保持居中。
- 风格检查项：整体终端感较强；需补强飞行器信息密度，统一 `term-btn`/`term-btn-sm` 与全局 `flight-primary`/`flight-secondary` 的视觉 token，减少橙色大面积风险。

### 镜像档案页 `miniprogram/pages/mirror-dossier/*`
- 功能检查项：生成档案卡、复制文字、打开卡片面板、生成图片、保存到相册、分享按钮、关闭预览必须可用；保存失败需引导权限设置。
- 布局检查项：长文本判读必须 50 字以内或折叠；海报预览按钮不得超出底部安全区。
- 风格检查项：档案卡需更像玩家飞行档案而不是普通报告页；保存/分享按钮需统一图标化和切角。

### 身份页 `miniprogram/pages/profile/profile.*`
- 功能检查项：头像授权、昵称输入、防抖保存、随机代号、数据矩阵跳转、声音开关、音色弹层、动效开关、触感开关、终端信息、断开终端确认必须验证；设置保存失败需回滚或提示。
- 布局检查项：未登录态仍使用 `button.btn-primary` 行内宽度；头像原生 button 需去默认边框；统计卡片「胜率」文案需改为「正反馈率」或「正向样本率」以避开敏感表达。
- 风格检查项：身份页主体已终端化；系统控制仍偏设置列表，需强化航空仪表盘分组、状态点、线框图标和 HUD 标签。

### 设置页 `miniprogram/pages/settings/settings.*`
- 功能检查项：声音、音色、动效、触感保存与本地缓存同步；抽屉关闭、音色试听、分类切换、单例音频停止必须验证。
- 布局检查项：当前仍是 `glass-card settings-card` 传统设置卡，需改成系统协议二级终端；开关区在小屏不得拥挤。
- 风格检查项：需从普通设置页迁移为 `SYSTEM PROTOCOL` 航电面板；开关使用飞行器拨杆/状态灯；删除旧 `custom-switch` 普通样式。

### 音色页 `miniprogram/pages/voice-select/*`
- 功能检查项：打开抽屉、关闭返回、分类切换、试听、选中、保存并返回必须验证；重复试听必须 `stop() -> src替换 -> play()` 单例。
- 布局检查项：当前 close 使用文本 `×`；分类图标仍依赖 `item.icon`，若 catalog 返回 Emoji 会直接展示；底部抽屉需防止内容顶出。
- 风格检查项：需替换为线框关闭图标和纯 CSS/类名图标；分类使用 `enLabel/zhLabel` 或纯色 line icon，禁止彩色 Emoji。

### 结算页 `miniprogram/pages/settle/*`
- 功能检查项：从 `score-records` 点击历史空间进入；图表、汇总、成员表、关系网络、低样本提示、加载失败重试均需可用。
- 布局检查项：后端 `room.status` 不归档会导致历史入口查不到已封存空间，需先修后端；结算页需校验 `all_record` 与 `room_member.final_score` 一致。
- 风格检查项：将「赢家/输家」内部命名和注释改为正/负反馈，页面文案避免胜负导向。

### 积分流水页 `miniprogram/pages/score-records/*`
- 功能检查项：进入页面加载 `/score/yield-log`，点击历史任务跳转结算页；空状态、失败态、低样本态均需可恢复。
- 布局检查项：历史列表长名称和时间不得溢出；曲线图 canvas 初始化失败需提示。
- 风格检查项：用飞行记录仪/任务日志表述替代传统流水列表；保持冷色仪表盘密度。

### 公共组件
- 功能检查项：`helmet-avatar` 空头像不得再出现 `src=null`；`matrix-overview` 关系面板、`flow-log-panel` 矩阵入口、`score-network` 节点详情、`terminal-popup` 确认弹窗、`round-confirm-modal`、`host-fill-modal`、`member-fill-modal` 必须逐项点击。
- 布局检查项：所有弹层使用 `wx:if` 懒渲染或 active 状态后销毁；关闭按钮点击区域不少于 64rpx。
- 风格检查项：所有关闭、确认、取消、分享、保存、返回按钮使用统一线框图标/切角按钮，不使用彩色 Emoji 和默认圆角 button。

## 三、多账号联调计划
- 账号数量覆盖：必须覆盖 1-12 人；已完成 API 模拟账号 R1/R2/R3/R4/R5，仍需在微信开发者工具多账号面板选择虚拟账号 v1-v12 复核前端真实渲染与 WS 事件。
- R1 1人：创建空间，检查成员状态为 1/16，排行榜显示创建者 0 分，封存后 `room.status=1`、`room_member.final_score=0`、`quit_time IS NOT NULL`。
- R2 2人：成员接入，A->B 记录 7，B->A 记录 3，校验前端成员分数 A=-4/B=4、Redis ZSet、API ranking、MySQL settle 完全一致；测试成员退出与房主解散。
- R3 3-4人：轮流记录多条，测试非房主封存拦截、重复确认、重名提示、Mode 2 主控统录与成员自填；校验 `round_record` 状态机。
- R4 5-8人：并发点击记录，观察 WS 延迟、页面掉帧、成员网格是否溢出；校验 `sr:room:{rid}:events` 数量等于前端流向日志数量。
- R5 9-12人：压力渲染与多端同步，至少 24 次流转，要求前端图表/成员卡/流向日志与 Redis/MySQL 一致；结算后历史页能看到封存空间。
- 角色分配：v1 主控，v2/v3 高频流转，v4 退出重入，v5-v8 并发观察，v9-v12 满员渲染与低频记录。
- 积分变动路径：每轮使用固定矩阵 `v1->v2 7`、`v2->v3 5`、`v3->v1 2`、`v4->v2 3`，8/12 人追加环形流转 `vi->v(i+1) 1`；预期净分由脚本生成后逐项核对。
- 数据库核对字段清单：`room.status`、`room.all_record JSON_LENGTH`、`room_member.final_score`、`room_member.quit_time`、`round_record.status`、`round_record_detail.score`、`user_identity_level.match_count/experience`。
- Redis 核对字段清单：`sr:room:{rid}:meta` 成员数、`sr:room:{rid}:scores` 全员 ZSet、`sr:room:{rid}:events` 流向数、`sr:user:rooms:{uid}` 结算后移除、`sr:room_no:{roomNo}` 归档后移除或不可接入。

## 四、问题清单
### 问题1
- 所属页面/模块：后端 `ScoreServiceImpl.doSettleRoom`、`ScoreServiceImpl.doSettleRoundRecordRoom`
- 复现步骤：创建自由流转空间，完成 16 人接入，执行一次 `/score/transfer`，调用 `/score/room/{roomId}/settle`，查询 `SELECT status, JSON_LENGTH(all_record) FROM room WHERE id=?`。
- 实际结果：API 返回 200 且 `room_member.final_score/quit_time` 写入，但 `room.status=0`；自动矩阵 1/2/4/8/12 人与边界 16 人均复现。
- 预期结果：封存成功后 `room.status=1`，历史接口可查，已封存空间不可再次加入或重复结算。
- 影响范围：历史列表、身份等级、镜像样本、自动恢复、用户活跃空间判断、重复创建空间。
- 优先级：Critical
- 修复建议：在两个结算分支写 `allRecord` 时同时 `room.setStatus(1)`，并在同一事务内更新；清理 `sr:room_no:{roomNo}`；补充结算后二次 settle 返回业务错误的测试。

### 问题2
- 所属页面/模块：后端 `getRoomRanking` / Redis scores 初始化 / 前端空间页成员网络
- 复现步骤：创建 16 人空间，不做任何流转，调用 `/score/room/{roomId}/ranking`；执行一条 A->B 流转后再次查询。
- 实际结果：无流转时 `rankingCount=0`；一次流转后只返回 A/B 两人，其他 14 名 0 分成员缺失。
- 预期结果：进行中排行榜始终返回全体成员，0 分成员以 `score=0` 排在非零分之后，前端成员网格和图表数据完整。
- 影响范围：1 人 R1、9-12 人压力渲染、成员图表、结算前对账。
- 优先级：High
- 修复建议：创建/加入时对 `sr:room:{rid}:scores` 执行 `ZADD uid 0`；或 `getRoomRanking` 合并 meta 成员补 0，推荐两者都做，保持 Redis 与 API 一致。

### 问题3
- 所属页面/模块：微信开发者工具 Console / 可能涉及 `fortune.js` 生成动画、canvas、网络请求或基础库调用
- 复现步骤：打开 DevTools，切换空间页/策略页，观察 Console。
- 实际结果：Console 持续显示 `Error: timeout`，同时有 6 条工具/基础库警告。
- 预期结果：业务代码不产生 Error；工具警告可记录但不能掩盖真实异常。
- 影响范围：前端调试质量、自动化测试可信度、策略页生成体验。
- 优先级：High
- 修复建议：先清空 Console 后逐页进入，打开 Network 与 AppData 定位超时来源；检查 `wx.login`、`wx.canvasToTempFilePath`、`request` 超时和未捕获 Promise；所有超时必须进入页面错误态。

### 问题4
- 所属页面/模块：策略页前后端 `fortune.*`、`FortuneServiceImpl`
- 复现步骤：进入策略页成功态，观察页面顶部与策略主题；搜索 `lunarDate`、`solarTerm`、`农历`、`节气`。
- 实际结果：页面展示干支/农历/节气；后端 SYSTEM_PROMPT 要求“农历/节气意象”，Prompt 要求“必须引用节气/农历意象”。
- 预期结果：策略模块只呈现状态管理、节奏提醒、风险控制；农历/节气只可作为不可见弱上下文或完全移除，不得显性玄学化。
- 影响范围：小程序审核、产品定位、分享海报。
- 优先级：High
- 修复建议：前端删除 `page-lunar` 展示与海报农历行；后端 Prompt 改为“时间窗口/节奏窗口/环境变量”，不强制引用；保留敏感词过滤，新增前端二次过滤对 `lunarDate/solarTerm` 不展示。

### 问题5
- 所属页面/模块：昵称生成器 `NicknameGenerator.java`、`miniprogram/utils/nickname.js`、用户默认昵称
- 复现步骤：搜索昵称池。
- 实际结果：存在 `专业发牌员`、`雀神`、`牌王`、`赢家`、`输家`、`财神`、`赢麻了`、`输麻了`、`开始做法` 等高风险或玄学/胜负导向词。
- 预期结果：昵称池只输出太空、飞行、记录、节奏、档案、协作、状态相关安全词。
- 影响范围：登录默认昵称、身份页随机代号、重名提示、分享内容。
- 优先级：High
- 修复建议：同步清洗前后端昵称池，改为如「星港」「巡航」「观测」「脉冲」「航电」「记录员」「校准中」等；添加单元/脚本扫描禁止词。

### 问题6
- 所属页面/模块：身份页、结算页、后端 DTO 示例与内部变量
- 复现步骤：搜索 `胜率`、`winner`、`loser`、`赢`、`输`。
- 实际结果：身份页展示「胜率」；结算页内部使用 `winner/loser`；DTO 示例有“上局赢的”；音频配置为 `win/lose`。
- 预期结果：用户可见文案改为「正反馈率」「高点成员」「低点成员」「数值变化」；内部命名可逐步迁移，至少用户可见和 DTO 示例先清理。
- 影响范围：审核、产品表达一致性。
- 优先级：Medium
- 修复建议：前端文案先改，DTO example 改为「本轮数值变化」；后端音频配置保持兼容时新增 neutral 命名别名。

### 问题7
- 所属页面/模块：设置页 `settings.*` 与音色页 `voice-select.*`
- 复现步骤：打开身份页音色弹层或设置页，检查 WXML/WXSS。
- 实际结果：设置页仍为 `glass-card settings-card` 传统设置卡；音色页关闭按钮是文本 `×`；音色分类可能直接显示 `item.icon`，存在彩色 Emoji 风险。
- 预期结果：二级设置为 `SYSTEM PROTOCOL` 飞行器控制面板，线框图标、状态灯、切角按钮、金属边框；不展示 Emoji。
- 影响范围：页面风格一致性、审核安全。
- 优先级：Medium
- 修复建议：复用身份页 `sys-row` 与全局 `avionics-switch`，关闭按钮改 `.fi--close`，分类图标改 CSS class 或 `enLabel/zhLabel`。

### 问题8
- 所属页面/模块：空间页弹层与按钮
- 复现步骤：搜索 `btn-primary`、`button`、分享/结算/重名弹窗。
- 实际结果：未登录态、进入空间按钮、部分弹层仍混用默认 button 或旧按钮；数字键盘 `C/⌫` 功能感强但飞行器图标化不足。
- 预期结果：所有按钮统一为 `flight-primary` / `flight-secondary` / `danger`，loading 文本绝对居中，图标绝对定位。
- 影响范围：视觉一致性、触控反馈。
- 优先级：Medium
- 修复建议：新增或复用全局按钮组件样式；改造 `room.wxml` 行 16、326、454-464、540-554、619-767 附近控件。

### 问题9
- 所属页面/模块：动效静默与性能
- 复现步骤：搜索 `setTimeout`、`requestAnimationFrame`、`setInterval`；关闭动效后进入策略页、登录页、雷达图、score-timeline。
- 实际结果：多数 CSS 有 reduce-motion；但策略页 JS 日志动画、登录步骤动画、部分 canvas requestAnimationFrame 仍需确认是否完全跳过。
- 预期结果：`animationEnabled=false` 时不启动非必要定时器、不启动 RAF，所有动画 0 延迟静态展示。
- 影响范围：2C2G 性能、低端机体验。
- 优先级：Medium
- 修复建议：在 `_runLogAnimation`、登录 `_runBootSequence`、canvas 动画入口先判断 reduce-motion；测试关闭动效后无持续定时器。

### 问题10
- 所属页面/模块：多账号 DevTools 前端联调
- 复现步骤：DevTools 多账号调试面板选择 v1-v12，逐轮运行真实前端路径。
- 实际结果：本轮已确认面板可用并完成 API 模拟矩阵；真实多开前端矩阵尚未全部执行。
- 预期结果：v1-v12 实际小程序窗口中完成创建、接入、流转、退出、封存、图表与数据库核对。
- 影响范围：WS 同步、前端渲染、真实用户路径。
- 优先级：Medium
- 修复建议：修复 Critical 后执行真实 DevTools R1-R5；记录每轮截图、Console、Network、DB 对账。

## 五、改进执行方案
- 前端修改项：`miniprogram/pages/fortune/fortune.wxml:6-8,93-95` 删除/隐藏 `page-lunar`；`fortune.js:139-152,338-353,459-466` 不拼接展示农历/节气，海报改为 `STRATEGY WINDOW`；`profile.wxml:90-93` 改「胜率」为「正反馈率」；`settings.wxml:1-109` 改为航电系统协议面板；`voice-select.wxml:11-15,29` 删除文本 `×` 和 `item.icon` 直出；`room.wxml` 所有 `btn-primary` 和原生 button 统一为飞行器按钮。
- 样式修改项：全局 token 增补 `--color-neon-cyan:#00FFFF`、`--color-electric-purple:#8B00FF`、`--color-amber:#FFB000`；按钮高度 72-88rpx；普通卡 `background:rgba(255,255,255,0.035)`、`border:1rpx solid rgba(0,255,255,0.16)`；危险按钮仅红色描边；禁止新增 `transition: all`。
- 后端修改项：`ScoreServiceImpl.java:403-405` 与 `603-605` 增加 `room.setStatus(1)`；结算清理 `sr:room_no:{roomNo}`；`getRoomRanking` 合并 meta 补 0；`RoomServiceImpl.initRoomRedis/joinRoom` 初始化 scores 0 分；`FortuneServiceImpl.java:63-79,481-490,605-617` 改 Prompt 与返回字段策略；`NicknameGenerator.java` 清洗敏感昵称；DTO example 清理。
- 数据校验项：结算后 `room.status=1`；`room.all_record` 非空或空样本合法；`room_member.final_score` 覆盖全员；`quit_time` 全员非空；Redis `meta/scores/events/room_no/user:rooms` 按归档规则清理；历史接口可查封存空间；重复结算被拒绝。
- 自动化测试项：新增脚本或集成测试覆盖 1、2、4、8、12、16、17 人；覆盖 zero-score ranking；覆盖 settle status；覆盖 duplicate nickname；覆盖 validation 0/negative/self/nonmember；覆盖 strategy sensitive-word scan。
- DevTools 验收项：Console 清空后逐页进入无业务 Error；多账号 v1-v12 前端矩阵通过；每个页面主按钮、次按钮、危险按钮、关闭按钮、分享/保存按钮均符合飞行器风格。
- 性能验收标准：12 人并发积分同步端到端延迟 `<300ms`；24 次流转后空间页无明显卡顿；关闭动效后无持续 RAF/动画；普通卡片不得批量使用 `backdrop-filter`。
- 审核验收标准：`rg` 扫描用户可见前端、Prompt、fallback、分享文案、昵称池不出现禁词；策略页和海报不展示运势/农历/节气/玄学口吻；无彩色 Emoji。

## 六、回归测试清单
- 后端编译：`cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
- API 矩阵：重新执行 1、2、4、8、12 人自动矩阵，所有 Redis/API/MySQL 分数一致。
- 满员边界：16 人成功，17 人返回 HTTP 200 + code 4003，前端提示「当前空间已满员（最多16人）」。
- 零分排行：1 人空间和 16 人无流转空间 ranking 返回全员 0 分。
- 结算归档：自由流转和本局录入结算后 `room.status=1`、历史接口可查、重复结算失败、已封存不可加入。
- 异常输入：自转账、0、负数、非成员、重复昵称均被温和拦截。
- DevTools 主页面：登录、空间、策略、镜像、身份四个 Tab 无业务 Error；关键按钮点击有反馈。
- DevTools 二级页：设置、音色、结算、积分流水、镜像档案可进入、可返回、无遮挡。
- 多账号真实联调：v1-v12 完成 R1-R5，记录每轮前端显示、Redis、MySQL 对账。
- 视觉审查：所有页面黑底、霓虹青/电光紫/荧光橙点缀、等宽数据感、金属边框、玻璃面板、扫描线/静默动效一致；无普通表单页、无彩色 Emoji。
- 敏感词审查：前端 WXML/JS、后端 Prompt/fallback、昵称池、分享海报文案扫描通过。
