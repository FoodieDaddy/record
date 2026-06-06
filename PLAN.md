# 迭代计划 - 2026-06-06 - 第3轮

## 一、当前基线说明
- 版本状态：`6c8a459 test: 第3轮迭代前置快照 2026-06-06 14:07` 已作为本轮强制 Git 前置备份。该快照保留了第2轮验收结果、Claude 子 Agent 启动前现场、Codex 追踪日志和当时新增的 SQL 测试数据文件。
- 本轮目标：收口第2轮计划剩余项，审查 Claude 4-Agent 执行结果，继续把前端控件、随机代号、镜像标签和策略兜底文案收敛为赛博朋克 x 太空飞行器终端风格，同时清理测试数据中的高风险命名与 DevTools GUI 调试帧风险。
- 测试范围：`pages/login`、`pages/room`、`pages/fortune`、`pages/mirror/index`、`pages/mirror-dossier`、`pages/profile`、`pages/settings`、`pages/voice-select`、`pages/settle`、`pages/score-records`、公共组件、后端策略服务、空间/积分/结算接口、Redis/MySQL 数据一致性。
- 已执行动作：按要求调用 `claude --bare -p`，并让其读取根目录 `plan.md` 后执行 4 个子 Agent 分工。Claude 已正常退出，退出码 `0`，输出摘要记录在 `/tmp/claude-plan-run-round2-stream.log`。
- 本轮新增改动方向：Profile 系统控制开关航电化，Settings 面板圆角收敛，后端策略敏感词过滤补漏，前后端随机代号池终端化，镜像/策略展示词收敛，删除含高风险样例词的 SQL 测试数据文件，补充 `CHANGELOG.md` 与 `codex-changelog.md`。
- DevTools 当前状态：微信开发者工具 Stable v2.01.2510260 可打开 `miniprogram/`；已通过 CLI 清编译缓存并以 `--disable-gpu` 重开，未复现先前 `Error: timeout`。GUI Wxml 面板仍反复出现 `No document`，属于工具调试帧风险；但 `miniprogram-automator` 已成功连接自动化端口，完成 10 个页面/场景 DOM 巡检与身份页 3 个航电开关点击验证，结果文件 `/tmp/smart-record-devtools-automator-round3.json`。

## 二、页面级检查清单

### 登录页 `miniprogram/pages/login`
- 功能检查项：`身份认证` 按钮需可见、可点击；loading 状态文本居中不抖动；`wx.login -> /user/login -> app.setLoginInfo -> switchTab(room)` 链路失败时只展示简短 toast，不泄露 code/token。
- 布局检查项：automator 请求 `/pages/login/login` 时因本地已有 token 自动跳转至 `pages/room/room`，符合 `onShow -> switchTab(room)` 逻辑；需用清空 storage 的账号再复验未登录态首屏。
- 风格检查项：登录页 WXML 本身保留黑底、扫描线、终端接入、身份认证按钮；未登录态仍需在 GUI 渲染恢复后复看。
- 验收标准：清空 storage 后 3 秒内出现「终端接入 / 身份认证」内容；已登录态自动进入空间页；Console 无业务 Error；不泄露 code/token。

### 空间页 `miniprogram/pages/room`
- 功能检查项：启动空间、接入空间、扫描接入、复制识别码、成员点击、数值键盘、确认记录、取消键盘、退出/解散、封存、重名/满员/重复接入提示全部需要可操作。
- 布局检查项：1-16 人成员矩阵稳定；0 分成员必须展示；键盘和结算弹层不遮挡底部安全区；长流水不撑爆页面。
- 风格检查项：automator 命中 `.room-page=1`、`.empty-room=1`、`.cyber-card=2`、`.cyber-scan-card=1`、`.cyber-terminal-input=1`；空间终端、空间模式、扫描接入、识别码输入均渲染为 HUD 结构。仍需真机复核弹窗热区、头像兜底说明、危险按钮红色描边。
- 验收标准：16 人 ranking size=16；17 人 code `4003`；重复接入 code `4009`；封存后再流转 code `400` 且提示温和；automator 能稳定进入空间页。

### 策略页 `miniprogram/pages/fortune`
- 功能检查项：生成策略、缓存读取、force 刷新、失败 fallback、策略卡保存/分享均需走前后端双重过滤。
- 布局检查项：生成日志、结果卡、海报预览在小屏不遮挡；reduce-motion 时不启动多余日志动画链。
- 风格检查项：后端 fallback 已改为状态读数、节奏窗口、风险阈值、暂停线表达；不展示结果预测或收益承诺。
- 验收标准：源码扫描不出现运行时用户可见高风险词；后端 `FortuneServiceImpl` 命中过滤词时丢弃 LLM 输出并使用 fallback；automator 命中策略页结果卡与主操作入口。

### 镜像页 `miniprogram/pages/mirror/index`
- 功能检查项：20 题滑动测试、直接选择、档案同步、雷达锁定、低样本态、失败重试、分享画像入口可用。
- 布局检查项：MBTI 弹窗和滑动测试在低屏高度下按钮不被底部遮挡；雷达图居中。
- 风格检查项：MBTI 称号和人格信号已从压制/冒险/爆发类词收敛为控场、响应、边界、校准、情绪感知；继续保持行为画像终端，不使用心理鸡汤式长文。
- 验收标准：reduce-motion 下雷达/扫描类动画静默；样本不足态文案短且冷静。

### 镜像档案页 `miniprogram/pages/mirror-dossier`
- 功能检查项：生成档案卡、复制、生成图片、保存相册、分享、关闭预览、权限失败引导。
- 布局检查项：预览和按钮不溢出；判读文本应短句化。
- 风格检查项：保持档案卡/行为画像，不做普通报告页。
- 验收标准：保存失败可恢复；分享文案无高风险词。

### 身份页 `miniprogram/pages/profile`
- 功能检查项：头像授权、昵称防抖保存、随机代号、数据矩阵跳转、声音/动效/触感开关、音色弹层、断开终端确认。
- 布局检查项：系统控制区 3 个开关已从 `.cyber-switch` 升级为 `.avionics-switch`；automator 命中 `.terminal-page=1`、`.avionics-switch=3`、`.sys-row=5`。
- 风格检查项：航电滑轨、状态灯、等宽状态标签已统一至 Settings 风格；随机代号池已替换为舰桥、航电、记录、校准、巡检等终端化称号。
- 验收标准：automator 点击 3 个开关后 `voiceEnabled true->false`、`animEnabled true->false`、`vibrateEnabled true->false`；Storage、`app.globalData` 同步；reduce-motion 下滑轨 transition 静默。

### 设置页 `miniprogram/pages/settings`
- 功能检查项：声音、动效、触感、音色抽屉、保存失败提示。
- 布局检查项：`.sp-panel` 圆角由 28rpx 收敛为 24rpx；automator 命中 `.settings-page=1`、`.sp-panel=1`、`.avionics-switch=3`、`.voice-sheet=1`，开关与 Profile 保持一致。
- 风格检查项：SYSTEM PROTOCOL 面板保留玻璃拟态、金属边框、冷色微光；关闭按钮继续使用 CSS 线框图标。
- 验收标准：无 `transition: all`；reduce-motion 下抽屉与开关静默。

### 音色页 `miniprogram/pages/voice-select`
- 功能检查项：分类切换、试听、选中、保存返回、重复试听单例 `stop -> src -> play`。
- 布局检查项：底部抽屉不顶出；关闭按钮热区不少于 64rpx。
- 风格检查项：分类图标不得使用彩色 Emoji；关闭按钮使用 CSS 线框。
- 验收标准：彩色 Emoji 扫描 0 命中；automator 命中 `.voice-card=8`；试听不重复创建音频实例。

### 结算页 `miniprogram/pages/settle`
- 功能检查项：历史空间进入、图表、成员表、关系网络、加载失败重试、低样本提示。
- 布局检查项：图表小屏不遮挡；成员 final_score 与数据库一致。
- 风格检查项：使用封存报告、数值变化、正/负反馈表达。
- 验收标准：`room.status=1`、`all_record` 非空或有单人成员快照、全员 `final_score` 非空；automator 可进入加载态「正在生成档案卡」。

### 积分流水页 `miniprogram/pages/score-records`
- 功能检查项：加载 `/score/yield-log`、历史任务跳转、空状态、失败重试、低样本态。
- 布局检查项：长名称、时间、曲线图不溢出。
- 风格检查项：飞行记录仪/任务日志表达，不写普通列表页；历史脏昵称属于既有数据风险，新随机代号池已改为终端化。
- 验收标准：单次请求返回后只 setData 必要字段。

### 公共组件
- 功能检查项：`helmet-avatar`、`matrix-overview`、`flow-log-panel`、`score-network`、`terminal-popup`、`round-confirm-modal`、`host-fill-modal`、`member-fill-modal` 点击与关闭可用。
- 布局检查项：弹层 `wx:if` 懒渲染；关闭按钮线框化；底部安全区正确。
- 风格检查项：纯色线框图标、金属边框、扫描线、弱英文 kicker 一致。
- 验收标准：组件无彩色 Emoji；关闭按钮不使用单独文本符号替代线框图标。

## 三、多账号联调计划
- 已完成 API/Redis/MySQL 矩阵：1、2、3、4、5、8、9、12 人，`/tmp/smart-record-matrix.json` run `1780725221422`，业务矩阵全通过。
- R1 1人：创建空间、ranking size=1、chart/network 空样本、结算归档。
- R2 2人：最小流转单元、封存后禁止再流转、重复接入 code `4009`。
- R3 3-4人：多向积分流转、角色权限边界、图表和关系网络。
- R4 5-8人：并发流转、页面渲染性能、全员 final_score。
- R5 9-12人：满屏成员压力、数据一致性、封存归档。
- 满员扩展：16 人接入成功；第 17 人 code `4003`。
- DevTools 真实多账号：v1/v2 曾可勾选，v3-v12 连续勾选受 accessibility 索引刷新限制。当前 automator 已验证单实例页面 DOM，但不能替代真实 1-12 多开 WebSocket UI；v3-v12 仍标记待人工确认。
- 数据库核对字段：`room.status`、`JSON_LENGTH(room.all_record)`、`room_member.final_score`、`room_member.quit_time`、成员总数、`SUM(final_score)`。
- Redis 核对字段：`sr:room:{rid}:scores`、`events`、`batches`、`overview`、`sr:room_no:{roomNo}`、`sr:user:rooms:{uid}`。

## 四、问题清单

### 问题1
- 所属页面/模块：微信开发者工具 GUI 调试帧
- 复现步骤：打开 DevTools -> 清 Console -> 点击编译/刷新 -> 观察 Wxml 面板与模拟器。
- 实际结果：CLI 清编译缓存并以 `--disable-gpu` 重开后，automator 可读取页面 DOM；但 GUI Wxml 面板仍出现 `No document`，Computer Use 对重开后的窗口抓取不稳定。
- 预期结果：GUI 模拟器和 Wxml 面板均能稳定显示当前页面 DOM。
- 影响范围：人工视觉巡检、真实多账号 UI 联调截图取证。
- 优先级：Medium
- 修复建议：保留 `--disable-gpu` 启动方式；后续可清 session/storage 或升级 DevTools；以 automator 页面 DOM 巡检作为本轮工具级补偿证据，但不替代多账号 UI 联调。

### 问题2
- 所属页面/模块：后端 `FortuneServiceImpl` 策略过滤
- 复现步骤：LLM 或 fallback 返回前端曾替换但后端未列入的高风险词。
- 实际结果：第2轮后发现后端过滤列表仍缺少若干前端替换项。
- 预期结果：后端优先拦截并 fallback，前端再二次替换。
- 影响范围：策略页审核安全、分享海报、缓存内容。
- 优先级：High
- 修复建议：已补充后端过滤项；保留 Unicode 字面量，避免源码直接出现中文高风险词。

### 问题3
- 所属页面/模块：身份页系统控制区
- 复现步骤：打开身份页，检查声音/动效/触感开关。
- 实际结果：原样式是文字方块 `.cyber-switch`，和 Settings 的航电滑轨不统一。
- 预期结果：统一为 `.avionics-switch`，包含 track、thumb、ACTIVE/OFF。
- 影响范围：身份终端视觉一致性。
- 优先级：Medium
- 修复建议：已升级；automator 点击验证通过，仍需真机复看触控手感。

### 问题4
- 所属页面/模块：测试数据 SQL
- 复现步骤：扫描 `backend/src/main/resources/sql/gen_test_data.py` 与 `test_data_output.sql`。
- 实际结果：测试昵称和备注包含高风险用户可见词，且文件为临时生成物。
- 预期结果：不提交含高风险样例词的测试数据；若后续需要测试种子，使用中性代号与状态记录语义。
- 影响范围：审核安全、仓库样例数据质量。
- 优先级：Medium
- 修复建议：本轮删除这两个临时 SQL 测试数据文件；后续如需恢复，必须使用「成员001/记录员/回稳」等安全命名。

### 问题5
- 所属页面/模块：DevTools 多账号 v3-v12
- 复现步骤：打开多账号调试面板，连续选择 v1-v12。
- 实际结果：工具 accessibility 索引刷新导致 v3-v12 无法稳定自动勾选；automator 仅覆盖单实例页面 DOM，未完成真实多开 UI。
- 预期结果：真实多开完成 1-12 人前端路径，或记录为待人工确认并以 API/Redis/MySQL 矩阵做业务一致性补偿。
- 影响范围：真实 UI WebSocket 同步验证。
- 优先级：Medium
- 修复建议：人工或更稳定工具复验 v1-v12；不可把 API 矩阵或单实例 automator 冒充为真实 DevTools 多开。

## 五、改进执行方案
- 前端修改项：
  - `miniprogram/pages/profile/profile.wxml`：系统控制 3 个开关改为 `.avionics-switch` 结构。
  - `miniprogram/pages/profile/profile.wxss`：新增航电滑轨样式与 reduce-motion 静默规则。
  - `miniprogram/pages/settings/settings.wxss`：`.sp-panel` 圆角调整为 `24rpx`。
  - `miniprogram/utils/nickname.js`：随机代号池改为舰桥、航电、记录、校准、巡检等终端化称号。
  - `miniprogram/utils/mbti-const.js`、`miniprogram/pages/mirror/index.js`、`miniprogram/pages/mirror-dossier/mirror-dossier.js`、`miniprogram/utils/domain-display.js`：镜像与策略展示词收敛为控场、响应、边界、校准、回稳。
- 后端修改项：
  - `backend/src/main/java/com/smartrecord/service/impl/FortuneServiceImpl.java`：后端策略过滤补漏，保留 Unicode 转义词表。
  - `backend/src/main/java/com/smartrecord/util/NicknameGenerator.java`：后端新用户默认昵称池同步终端化。
  - `backend/src/main/java/com/smartrecord/service/impl/BattlePersonaServiceImpl.java`、`MirrorProfileServiceImpl.java`、`MbtiCalculator.java`、`FortuneResp.java`、`MirrorProfileResp.java`：镜像/策略输出示例与称号收敛。
- 数据与文档修改项：
  - 删除 `backend/src/main/resources/sql/gen_test_data.py` 与 `backend/src/main/resources/sql/test_data_output.sql`。
  - 更新 `plan.md`、`CHANGELOG.md`、`codex-changelog.md`，写明真实测试状态与未解决风险。
- 样式 Token：
  - 主高亮 `#0A84FF`，辅助青 `#00C8FF`，紫 `#5E5CE6`，成功绿 `#30D158`，危险红 `#FF453A`。
  - 普通卡片半透明黑底、细描边；危险操作透明底红描边；开关使用航电滑轨。
- 数据校验项：
  - `room.status=1`、`room_member.final_score` 全员非空、`SUM(final_score)=0`、Redis room_no 清理。
  - 过滤命中时 `fortune_log` 可记录 fallback 来源，不向前端暴露高风险词。
- 验收标准：
  - Java 编译通过；Docker MySQL/Redis Up；Swagger HTTP 200。
  - 风险词扫描：运行时代码与 resources 除过滤词表定义外 0 命中。
  - DevTools automator 10 页面/场景巡检 0 failures；GUI Wxml `No document` 作为 Medium 工具风险记录。
  - Critical Issue 清零后才能进入最终完成提交；若 DevTools v3-v12 多开仍未确认，提交信息必须标注待人工确认风险。

## 六、回归测试清单
- `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
- `docker compose -f /Users/happy/Documents/record/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}"`
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/api/swagger-ui.html`
- 读取 `/tmp/smart-record-matrix.json`，确认 1/2/3/4/5/8/9/12 人矩阵、16/17 边界、重复接入和封存后拒绝流转。
- 扫描 `transition: all`、彩色 Emoji、危险日志、JWT/WS URL 泄露。
- 扫描高风险词，过滤词表定义行需单独说明，运行时展示和测试数据不得命中。
- DevTools：CLI 清缓存并 `--disable-gpu` 打开 -> automator 巡检 10 页面/场景 -> 记录 GUI Wxml 面板是否仍有 `No document` -> 再进入多账号调试面板。
- Profile/Settings：声音、动效、触感开关点击状态一致，视觉为航电滑轨。
- Room：弹窗关闭按钮热区、数字键盘、封存按钮、断开按钮风格复查。
