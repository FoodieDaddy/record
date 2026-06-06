# 迭代计划 - 2026-06-06 - 第4轮

## 一、当前基线说明
- 版本状态：`c8b4ef7 test: 第4轮迭代前置快照 2026-06-06 17:48` 已作为本轮强制 Git 前置备份。该快照基于第3轮完成提交 `d4b8857`，第3轮已完成身份页航电开关、策略/镜像/代号池终端化、测试 SQL 清理与 DevTools automator 页面巡检。
- 本轮目标：在完整 1-12 人 API/Redis/MySQL 矩阵通过的基础上，继续做页面级深度审查，修复运行时仍可能透出的旧画像/旧状态词，降低 DevTools 调试器 error/warning 噪声，并把所有页面继续压回黑底、冷光、航空仪表盘式终端风格。
- 测试范围：`pages/login`、`pages/room`、`pages/fortune`、`pages/mirror/index`、`pages/mirror-dossier`、`pages/profile`、`pages/settings`、`pages/voice-select`、`pages/settle`、`pages/score-records`、公共组件、空间/积分/结算 API、镜像画像 API、Redis/MySQL 归档一致性、微信开发者工具 GUI 与 automator。
- 已执行测试：
  - Java 编译：`JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q` 通过。
  - Docker：`sr-mysql`、`sr-redis` 均 Up。
  - API 可达：`/api/swagger-ui.html` HTTP 200。
  - 第4轮 API/Redis/MySQL 矩阵：`/tmp/smart-record-round4-matrix.json`，run `1780739562112`，覆盖 1/2/3/4/5/6/7/8/9/10/11/12 人，`failureCount=0`；16 人成功、第 17 人 code `4003`、重复接入 code `4009`、封存后再流转拦截通过。
  - 第4轮 automator：`/tmp/smart-record-round4-automator.json`，10 个页面/场景选择器巡检与身份页 3 个航电开关点击验证通过；但脚本使用的 `page.text()` 不受当前 SDK 支持，文本采样为工具缺陷，需改为元素/数据级取证。
  - DevTools GUI：Stable v2.01.2510260 已打开项目；模拟器与 Wxml Page DOM 可见，不再是 `No document`；调试器仍显示 `1 error, 6 warnings`，需继续定位 Console 具体内容。
- 本轮关键发现：DevTools GUI 曾在镜像页可访问树中显示历史旧词 `规则型压制者`、`规则压制`，源码已清理但运行时可被缓存/数据库历史字段带出。必须做后端输出净化和前端展示净化，不能只靠源码常量清理。

## 二、页面级检查清单

### 登录页 `miniprogram/pages/login`
- 功能检查项：未登录态应显示终端接入、身份认证按钮；已登录态自动进入空间页；失败态只展示简短 toast，不打印微信 code 或 token。
- 布局检查项：automator 请求 `/pages/login/login` 时实际进入 `pages/room/room`，说明当前 Storage/token 为已登录状态；仍需清空 Storage 后复验未登录首屏。
- 风格检查项：保持黑底、扫描线、终端接入，不做微信默认登录表单。
- 验收标准：未登录态 3 秒内出现 `.login-page`、`.login-btn`；已登录态跳转空间页；Console 无登录链路业务 error。

### 空间页 `miniprogram/pages/room`
- 功能检查项：启动空间、接入空间、扫描接入、识别码输入、成员点击、流转记录、退出/解散、封存、重复接入/满员提示。
- 布局检查项：automator 命中 `.room-page=1`、`.empty-room=1`、`.cyber-card=2`、`.cyber-create-btn=2`、`.cyber-scan-card=1`、`.cyber-terminal-input=1`、`.reduce-motion=1`；DevTools GUI 可见空间页和 Wxml DOM。
- 风格检查项：空间模式、接入空间、扫描接入呈 HUD 卡片；仍需复核 1-16 人满员矩阵和弹窗热区。
- 验收标准：1-12 人矩阵 ranking size 与成员数一致；16 人 ranking size=16；17 人 code `4003`；封存后 transfer 非 200。

### 策略页 `miniprogram/pages/fortune`
- 功能检查项：生成策略、缓存读取、重新推演、策略卡分享、失败 fallback。
- 布局检查项：automator 命中 `.flight-primary=1`、`.result-card=1`、`.reduce-motion=1`；需补充 text/data 级验证。
- 风格检查项：保持策略终端和航电提示，不出现预测、收益承诺或非策略化词汇。
- 验收标准：静态扫描和运行时文本均无高风险词；后端 fallback 命中过滤词时丢弃 LLM 输出。

### 镜像页 `miniprogram/pages/mirror/index`
- 功能检查项：MBTI 直接选择、20 题校准、档案同步、雷达展示、人格偏差、系统判读、生成档案入口。
- 布局检查项：automator 命中 `.terminal-card=7`、`.reading-card=1`、`.signal-tag=5`、`.flight-primary=1`、`.reduce-motion=1`；DevTools GUI 曾显示完整镜像页。
- 风格检查项：源码常量已终端化，但 GUI 曾显示旧历史词 `规则型压制者`、`规则压制`；需要后端/前端输出净化，把旧词映射到 `规则型控场者`、`规则控场`。
- 验收标准：`/mirror/profile` 返回体、页面 data、Wxml 可访问文本、档案分享文本均不得出现旧画像词；缓存命中和数据库历史字段都要被净化。

### 镜像档案页 `miniprogram/pages/mirror-dossier`
- 功能检查项：加载档案、复制文本、生成图片、保存相册、分享、关闭预览。
- 布局检查项：automator 仅做 route/selector 级覆盖；需补充真实有数据状态。
- 风格检查项：复制文本、分享标题、海报 canvas 必须同样经过旧词净化。
- 验收标准：`copyText`、`share.title`、canvas 绘制文本均不出现旧画像词或高风险词。

### 身份页 `miniprogram/pages/profile`
- 功能检查项：昵称、头像、随机代号、数据矩阵、声音/动效/触感开关、音色抽屉、断开终端。
- 布局检查项：automator 命中 `.terminal-page=1`、`.avionics-switch=3`、`.sys-row=5`、`.reduce-motion=1`；点击 3 个开关后状态从 `false/false/false` 依次变为 `true/false/false`、`true/true/false`、`true/true/true`。
- 风格检查项：航电滑轨统一，状态文本保持 ACTIVE/OFF；成就/统计文案继续使用正反馈、样本、稳定性。
- 验收标准：开关状态同步 `Storage + app.globalData + 页面 data`；无 `transition: all`。

### 设置页 `miniprogram/pages/settings`
- 功能检查项：声音、动效、触感、音色抽屉、保存失败提示。
- 布局检查项：automator 命中 `.settings-page=1`、`.sp-panel=1`、`.avionics-switch=3`、`.voice-sheet=1`、`.reduce-motion=1`。
- 风格检查项：系统协议面板继续采用金属描边与玻璃面板；关闭按钮为线框图标。
- 验收标准：Profile/Settings 开关视觉一致，reduce-motion 静默。

### 音色页 `miniprogram/pages/voice-select`
- 功能检查项：分类切换、试听、选中、保存返回、重复试听单例。
- 布局检查项：automator 命中 `.voice-card=8`、`.voice-list=1`、`.reduce-motion=1`；`.voice-select-page` 为 0，需确认根节点实际类名是否符合全局规范。
- 风格检查项：分类图标无彩色 Emoji，关闭按钮线框化。
- 验收标准：彩色 Emoji 扫描 0；音频实例单例复用。

### 结算页 `miniprogram/pages/settle`
- 功能检查项：历史空间进入、图表、成员表、关系网络、低样本、加载失败重试。
- 布局检查项：无 roomId 参数时 automator 只进入 loading/空 route，`.settle-page=0`、`.terminal-card=0`；需用真实已封存 roomId 进行补充巡检。
- 风格检查项：任务档案、封存序列、数值演化、关系网络保持终端风格。
- 验收标准：带 `roomId` 的巡检能出现封存序列或空状态，不长期停留 loading。

### 积分流水页 `miniprogram/pages/score-records`
- 功能检查项：加载 `/score/yield-log`、历史任务跳转、空状态、失败重试。
- 布局检查项：automator 当前 `.records-page=0`、`.score-records-page=0`、`.terminal-card=0`，需要确认页面根类和有数据态选择器。
- 风格检查项：飞行记录仪/任务日志表达，不使用普通列表页。
- 验收标准：有样本用户进入后显示 `脉冲日志`、采样状态、任务档案；空状态不遮挡底部。

### 公共组件
- 功能检查项：`helmet-avatar`、`matrix-overview`、`flow-log-panel`、`score-network`、`terminal-popup`、`round-confirm-modal`、`host-fill-modal`、`member-fill-modal`。
- 布局检查项：弹层 `wx:if` 懒渲染，关闭按钮热区充足，底部安全区正确。
- 风格检查项：线框图标、金属边框、扫描线、弱英文 kicker 一致。
- 验收标准：组件无彩色 Emoji；关闭按钮不用纯文本符号冒充图标；reduce-motion 下静默。

## 三、多账号联调计划
- 账号数量覆盖：第4轮 API/Redis/MySQL 矩阵已覆盖 1-12 人全量连续矩阵，结果文件 `/tmp/smart-record-round4-matrix.json`，`failureCount=0`。
- R1 1人：创建空间 -> ranking 1 -> chart/network 空样本可返回 -> 结算 -> DB `room.status=1`、final_score=0、Redis room_no 清理。
- R2 2人：创建 -> 接入 -> 1 次最小流转 -> ranking total=0 -> chart/network -> 结算 -> 封存后流转拦截。
- R3 3-4人：相邻链式流转 -> 多节点 network -> 全员 final_score 非空 -> 总和 0。
- R4 5-8人：成员增长与多次流转 -> 页面渲染/接口响应稳定 -> DB/Redis 一致。
- R5 9-12人：满屏成员压力 -> 11 次链式流转 -> 结算归档 -> Redis 清理。
- 满员边界：16 人接入成功，ranking size=16，settle memberScores=16；第 17 人 code `4003`；重复接入 code `4009`；自转、0 分、非成员均拦截。
- DevTools 真实多账号：GUI 多开 v3-v12 仍未稳定自动勾选；本轮不得把 API 矩阵当作真实 UI 多开通过，继续列为 Medium 待人工确认。
- 数据库核对字段：`room.status`、`JSON_LENGTH(room.all_record)`、`room_member.final_score`、`room_member.quit_time`、成员数、`SUM(final_score)`。
- Redis 核对字段：`sr:room:{rid}:scores`、`sr:room:{rid}:events`、`sr:room_no:{roomNo}`、`sr:user:rooms:{uid}`。

## 四、问题清单

### 问题1
- 所属页面/模块：镜像页/镜像档案页/后端镜像画像
- 复现步骤：打开 DevTools GUI 镜像页，观察人格协议、系统判读、人格信号；或读取历史 `user_mirror_profile` / Redis `sr:mirror:profile:*` 缓存。
- 实际结果：GUI 曾显示 `规则型压制者`、`规则压制` 等第3轮前旧词；源码常量已清理，说明历史 DB/Redis 缓存或旧响应字段仍可透出。
- 预期结果：所有镜像响应和页面展示统一为 `规则型控场者`、`规则控场` 等终端化表达。
- 影响范围：镜像页、镜像档案页、复制文本、分享标题、海报 canvas、审核安全与视觉气质。
- 优先级：High
- 修复建议：新增前后端术语净化函数。后端在 `MirrorProfileServiceImpl.getFullProfile` 缓存读取后、构建响应后统一净化；前端在 `mirror/index.js`、`mirror-dossier.js` 对 `reading`、`traits`、`personaSignals`、`mbtiTitle` 做展示层兜底净化。

### 问题2
- 所属页面/模块：`BattlePersonaServiceImpl`、`FortuneServiceImpl`、`UserTag`、Profile 统计注释
- 复现步骤：宽口径扫描 `连胜|连败|胜率|爆发|压制` 等旧风格词。
- 实际结果：仍有 `连败` 注释/文案、UserTag 注释、策略颜色注释、Profile 注释等残留；运行时可能在镜像判读中显示 `连败风险`。
- 预期结果：运行时用户可见内容使用连续正反馈、连续负反馈、回稳风险、顺行状态等表达；注释也尽量与产品宪法一致。
- 影响范围：镜像判读、策略标签、身份统计、长期维护一致性。
- 优先级：Medium
- 修复建议：把用户可见 `连败` 改为连续负反馈/回稳压力；注释改成正反馈/负反馈；保留内部 enum 名但不直接展示旧词。

### 问题3
- 所属页面/模块：DevTools GUI 调试器
- 复现步骤：打开项目 -> 普通编译 -> 查看底部调试器标签。
- 实际结果：Wxml Page DOM 已可见，但调试器显示 `1 error, 6 warnings`。
- 预期结果：业务 error 清零；warning 至少可解释为工具/基础库提示。
- 影响范围：人工视觉巡检、页面质量判断。
- 优先级：Medium
- 修复建议：切到 Console 读取错误内容；若是业务错误必须修复，若是工具噪声写入 changelog 风险清单。

### 问题4
- 所属页面/模块：第4轮 automator 巡检脚本
- 复现步骤：运行 `/tmp/smart-record-round4-automator.cjs`。
- 实际结果：选择器巡检和开关点击通过，但 `page.text()` 不存在，9 个页面文本样本为 `TEXT_ERROR`。
- 预期结果：页面巡检能采集文本或 data 关键字段，用于自动发现旧文案。
- 影响范围：自动化视觉/文案巡检可信度。
- 优先级：Medium
- 修复建议：改用元素 `text()` 或 page `data()` 采样；不要把本轮 textSample 当成文案 0 命中的证据。

### 问题5
- 所属页面/模块：结算页/流水页 automator 场景
- 复现步骤：无参数直接 relaunch `/pages/settle/settle`、`/pages/score-records/score-records`。
- 实际结果：结算页和流水页关键选择器为 0，可能因缺 roomId 或当前用户样本状态不足。
- 预期结果：使用真实已封存 roomId/有样本 token 进入页面，验证有数据态和空状态。
- 影响范围：结算/流水页面视觉验收完整性。
- 优先级：Medium
- 修复建议：从第4轮矩阵取一个已封存 roomId，构造页面参数巡检；或通过页面 data/API 断言补足。

### 问题6
- 所属页面/模块：DevTools 真实多账号 v3-v12
- 复现步骤：打开多账号调试面板，尝试勾选 v1-v12。
- 实际结果：历史轮次中 v1/v2 可勾选，v3-v12 受 accessibility 索引刷新限制；本轮尚未完成真实 UI 多开。
- 预期结果：真实多开前端 WebSocket UI 也完成 1-12 覆盖。
- 影响范围：真实 UI 同步体验。
- 优先级：Medium
- 修复建议：继续保留待人工确认；提交说明不得写 `DevTools真实多账号1-12人通过`。

## 五、改进执行方案
- 前端修改项：
  - `miniprogram/pages/mirror/index.js`：新增 `sanitizeMirrorText` / `sanitizeMirrorObject`，在 `loadProfile` 和 `onSyncProfile` 写入 data 前净化 `mbti`、`traits`、`battlePersona`、`personaMatch`、`reading`、`personaSignals`。
  - `miniprogram/pages/mirror-dossier/mirror-dossier.js`：复用同等净化逻辑，覆盖复制、分享、canvas 绘制前的数据。
  - `miniprogram/utils/mbti-const.js`：确认本地常量不再含旧词，必要时导出净化映射供镜像页复用。
- 后端修改项：
  - `backend/src/main/java/com/smartrecord/service/impl/MirrorProfileServiceImpl.java`：缓存命中反序列化后也执行响应净化；构建响应后、写缓存前执行净化；必要时清理历史 profile 字段。
  - `backend/src/main/java/com/smartrecord/service/impl/BattlePersonaServiceImpl.java`：运行时判读文案中的 `连败风险` 等改为连续负反馈/回稳压力；注释同步收敛。
  - `backend/src/main/java/com/smartrecord/service/impl/FortuneServiceImpl.java` 与 `dto/fortune/UserTag.java`：注释和可见 fallback 避免旧状态词直出。
- 样式/交互修改项：
  - 不新增前端框架；沿用原生小程序 WXML/WXSS。
  - 保持黑底 `#0A0A0A`、主高亮 `#0A84FF/#00C8FF`、紫 `#5E5CE6`、危险红 `#FF453A`、荧光橙点缀。
  - 所有新增动画受 `.reduce-motion` 静默控制；不得添加 `transition: all`。
- 数据校验项：
  - `/mirror/profile` JSON 字符串扫描不得出现旧词。
  - Redis `sr:mirror:profile:*` 缓存刷新后不得出现旧词。
  - MySQL 历史字段即便仍有旧值，API 输出也必须净化。
- 验收标准：
  - Java 编译通过；Swagger HTTP 200；Docker MySQL/Redis Up。
  - `/tmp/smart-record-round4-matrix.json` 1-12 矩阵 `failureCount=0`。
  - DevTools/automator 页面巡检通过；若 Console 仍有 error，必须记录具体来源。
  - 静态扫描：高风险词、旧画像词、`transition: all`、彩色 Emoji、token URL 日志 0 命中，注释例外也需说明。
  - Critical Issue 清零；Medium 工具风险可保留但不得冒充通过。

## 六、回归测试清单
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
- `docker compose -f /Users/happy/Documents/record/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}"`
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/api/swagger-ui.html`
- 运行 `/tmp/smart-record-round4-matrix.cjs` 或读取 `/tmp/smart-record-round4-matrix.json`，确认 1-12 人、16/17 边界、重复接入、封存后流转拦截全部通过。
- 运行 DevTools automator 页面巡检，修复 `page.text()` 采样方式后重新记录文本/选择器结果。
- DevTools GUI：普通编译 -> Wxml DOM 可见 -> Console error 具体内容记录。
- `/mirror/profile`：清 Redis profile 缓存 -> 请求接口 -> JSON 扫描旧词 -> 打开镜像页/档案页复核。
- 静态扫描：
  - `rg -n "压制|压迫|爆发|冒险|突击|连胜|连败|胜率|赌博|下注|押注|筹码|牌局|赚钱|发财|运势|算命|占卜|塔罗|神谕|卦象|黄历|风水" miniprogram backend/src/main/java backend/src/main/resources -g '!backend/target/**'`
  - `rg -n "transition\\s*:\\s*all|DEBUG_WS\\s*=\\s*true|console\\.(log|error|warn).*token|\\?token=xxx|ws://.*token|wss://.*token" miniprogram backend/src/main/java backend/src/main/resources -g '!backend/target/**'`
  - `rg -n "[😀-🙏🌀-🗿🚀-🛿☀-⛿✀-➿]" miniprogram backend/src/main/resources backend/src/main/java -g '!backend/target/**'`
