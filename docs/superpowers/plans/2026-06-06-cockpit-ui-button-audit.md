# Smart Record 太空座舱 UI 与功能按钮逐项审查计划

> 生成日期：2026-06-06  
> 范围：原生微信小程序所有页面、弹窗、共享组件、功能按钮、触控图表、动效、样式与微信开发者工具验收。  
> 执行原则：不引入前端框架；只基于现有 WXML / WXSS / JS / 组件体系收敛为「赛博策略终端 / 太空飞机座舱 / 飞控任务面板」。

## 0. 目标结论

当前项目已经从普通记分工具转向「空间记录 -> 策略提示 -> 行为画像 -> 身份沉淀」的终端化产品线。主 Tab 的房间、策略、镜像、身份四页在微信开发者工具中已经具备黑底、蓝光、HUD、数据卡和终端标题，但还存在三个核心问题：

1. 控件语言不统一：主按钮、次按钮、危险按钮、关闭按钮、开关、分段按钮、底部抽屉仍各自为政，部分仍像微信普通设置页。
2. 赛博风有但太空飞机感不足：应从「玻璃卡 + 蓝光」继续升级为「飞控座舱、航电 HUD、任务芯片、雷达锁定、空间接入舱门」。
3. DevTools 控制台有真实问题：组件 WXSS 非法选择器、头像 `src=null`、`Error: timeout` 需要先清零，否则后续美术审查会被运行时噪声干扰。

最终验收体验必须是：

```text
房间页：我在启动或接入一个记录空间。
策略页：我在让飞控系统生成一条状态与行动建议。
镜像页：我在查看自己的行为画像与人格协议。
身份页：我在管理自己的玩家身份终端。
```

不是：

```text
我在填表 / 我在设置开关 / 我在抽卡 / 我在看普通列表 / 我在操作后台面板
```

## 1. 微信开发者工具审查记录

审查方式：

- 已使用微信开发者工具打开 `/Users/happy/Documents/record/miniprogram`。
- 模拟器设备为 iPhone 14 Pro Max。
- 已通过 `computer-use` 观察主 Tab：空间、策略、镜像、身份。
- 不触发有副作用的按钮：不点「断开空间」、不点「封存/结算」、不点确认提交、不点退出、不执行真实分享或保存。
- 二级页与弹窗通过源码静态审查补齐，后续执行计划时再逐页进入 DevTools 复核。

DevTools 已观察到的业务问题：

- Console：`1 error, 11 warnings`。
- `Error: timeout`，需要定位来源。
- `components/helmet-avatar/index.wxss:211:16`：组件 WXSS 使用了不允许的 tag selector，当前为 `.reduce-motion view, .reduce-motion image`。
- `components/helmet-avatar/index` 的 `src` 属性声明为 String，但调用方传入了 `null`，警告提示应使用空字符串。
- 房间页和身份页切换时都会触发头像组件警告。

DevTools 已观察到的视觉状态：

- 空间页：已呈现「空间终端 · SPACE」「成员网络」「流向日志」「空间扫描」，方向正确，像在线驾驶舱。但底部危险操作、成员卡、分享入口、键盘与弹窗仍需要统一飞控控件规范。
- 策略页：标题为「今日策略」，中央 `oracle-card` 仍有卡牌/玄学残影，需要改成「任务策略芯片 / 飞控计算核心 / 雷达锁定模块」。
- 镜像页：人格协议、雷达、可信度、偏差、判读、信号、演化完整，数据舱感强。但「重新校准 / 人格重构」等按钮仍偏普通矩形，信息密度偏高。
- 身份页：身份档案、数据矩阵、等级、成就、系统控制方向正确，像飞行员档案。但成就横滑过密，系统控制开关仍像普通设置，不够航电开关。
- DevTools 在一次 Tab 切换后可访问树短暂只显示外壳，应把自动化审查结果与源码清单交叉验证，避免仅凭一次截图下结论。

## 2. 全局太空座舱设计标准

### 2.1 视觉母题

统一母题：

- 飞控座舱：顶部状态栏、系统状态点、姿态仪式分区、航电小标签。
- 任务面板：每个任务块像一块可拆卸仪表，不像营销卡片。
- 雷达与航线：关系网络、趋势图、人格雷达使用细线、点阵、扫描弧。
- 接入舱门：登录、加入空间、分享二维码、确认弹窗都应像「接入 / 舱门 / 授权」流程。

禁止母题：

- 卡牌、星盘、占卜桌、娱乐抽取感。
- 赌场、筹码、牌桌、财富暗示。
- 大面积霓虹发光、大面积纯蓝、大圆角微信按钮。
- 所有按钮都发光、所有文字都蓝色、全部卡片都 backdrop-filter。

### 2.2 全局色彩语义

必须收敛到：

```css
--sr-bg: #0A0A0A;
--sr-primary: #0A84FF;
--sr-cyan: #00C8FF;
--sr-purple: #5E5CE6;
--sr-green: #30D158;
--sr-orange: #FF9F0A;
--sr-red: #FF453A;
--sr-text-main: rgba(255,255,255,0.92);
--sr-text-secondary: rgba(255,255,255,0.56);
--sr-text-muted: rgba(255,255,255,0.38);
```

语义约束：

- 蓝色：主操作、选中态、飞控锁定。
- 青色：扫描、雷达、数据流。
- 绿色：在线、成功、已同步、已连接。
- 橙色：等待、风险提醒、处理中。
- 红色：退出、封存确认、错误、危险。
- 白色透明度：关键正文不得低于 `0.40`。

### 2.3 全局控件语法

所有页面按钮统一为 5 类：

| 类型 | 用途 | 视觉 |
|---|---|---|
| `flight-primary` | 启动空间、接入空间、生成策略、同步协议、生成档案卡 | 切角细边、蓝色核心光、中文主文案居中、英文弱标签 |
| `flight-secondary` | 重新生成、复制、修改、查看详情 | 暗底细描边、低亮白字、轻微按压 |
| `flight-danger` | 退出、断开、封存确认、放弃修改 | 红色描边，不大面积填充 |
| `flight-chip` | 模式选择、时限选择、分类选择 | 小型舱内拨片，active 用边框/状态点，不整块高亮 |
| `flight-icon` | 关闭、复制、分享、扫描、箭头、随机昵称 | 线框图标或 CSS 线图标，不用纯文本 `x/×/✕` 当主图标 |

按钮结构要求：

- 文本绝对居中，loading 图标绝对定位，loading 后文案不横向偏移。
- 中文是主标签，英文只做小号代码标签。
- 高度 72rpx - 88rpx，底部主操作最多 96rpx。
- `transition` 只写明确属性，禁止 `transition: all`。
- `reduce-motion` 下取消动画和过渡，但保留静态状态反馈。

### 2.4 开关与选择器

当前身份页、设置页的 `ON/OFF` 开关需要升级为航电开关：

- 关闭态：`SAFE / OFF`，暗灰描边，滑块停在左侧。
- 开启态：`ARMED / ON`，蓝色或绿色边缘光，滑块停在右侧。
- 开关旁边必须有明确中文标题，如「声音协议」「动效协议」「触感协议」。
- 点击区域不少于 88rpx 宽，不只点击小圆点。
- 切换后用短 toast 或状态码反馈，避免用户误以为无响应。

### 2.5 弹窗与底部抽屉

所有弹窗统一为「舱门确认 / 任务面板」：

- 遮罩黑底透明，不使用大面积 blur。
- 顶部有中文标题 + 英文弱标签 + 细线。
- 关闭按钮使用统一 `flight-icon close`。
- 危险确认必须左取消右确认，确认按钮红色描边，文案不夸张。
- 底部抽屉使用 `wx:if` 懒渲染，不用长期 hidden。
- 抽屉打开时背景滚动锁定，Canvas 层不得穿透。

### 2.6 动效规范

允许：

- 轻微扫描线、雷达扫过、按钮按压、底部抽屉滑入、数值短暂滚动、头像轻微呼吸。

禁止：

- 长时间循环强发光。
- 大面积粒子。
- 打字机持续刷屏。
- 页面滚动时 setData。
- loading 超过 1.5 秒无状态反馈。

必须：

- 每个页面根节点有 `reduce-motion`。
- JS 动画、`setTimeout` 链、`requestAnimationFrame` 前都检查全局动效状态。
- `onHide/onUnload` 清理 timer、音频、动画帧。
- Canvas 动效在 `reduce-motion` 下直接绘制最终态。

## 3. P0 阻断项：先清运行时问题

### P0.1 修复 helmet-avatar 非法选择器

现状：

- `miniprogram/components/helmet-avatar/index.wxss:211` 使用 `.reduce-motion view, .reduce-motion image`。
- 小程序组件 WXSS 不允许 tag selector。

改进：

- 改为类选择器，例如 `.ha.reduce-motion .ha__glow`、`.ha.reduce-motion .ha__img`、`.ha.reduce-motion .ha__shell`。
- 不在组件 WXSS 内使用 `view/image/button` tag selector。
- 全局 `app.wxss` 可以继续做页面级兜底，但组件内必须遵守组件 WXSS 限制。

验收：

```bash
rg -n "\.reduce-motion (view|image|text|button|scroll-view|canvas)|(^|,)\s*(view|image|text|button|scroll-view|canvas)" miniprogram/components
```

组件 WXSS 无非法 selector 命中。

### P0.2 修复头像 `src=null`

现状：

- 头像组件默认值为 `''`，但调用方传入 `null` 时仍会触发 property 类型警告。

改进：

- 所有调用 `helmet-avatar` 的地方传入空字符串兜底，如 `src="{{item.avatarUrl || ''}}"`。
- `detailFrom.avatarUrl`、`detailTo.avatarUrl`、成员网格、身份页头像都做同样处理。
- 如果 WXML 复杂表达式不可维护，则在 JS 构造 view model 时统一归一化 `avatarUrl: item.avatarUrl || ''`。

验收：

- DevTools 切换房间页、身份页、矩阵弹窗时不再出现 `expected <String> but get null`。

### P0.3 定位并消除 `Error: timeout`

现状：

- DevTools Console 出现 `Error: timeout`，堆栈来自 WAServiceMainContext，业务来源不明显。

改进：

- 为登录、房间初始化、策略生成、二维码获取、音色加载、镜像档案加载增加短期调试标记：只记录接口名、耗时、错误码，不记录 token、openid、完整 URL。
- 检查所有 request timeout 是否有用户可见 fallback。
- 清理完成后移除或关闭详细调试日志。

验收：

- 冷启动、主 Tab 切换、进入房间、打开身份页、打开策略页时无业务 timeout error。
- 超时请求给出页面内短提示，不让 Console 成为唯一反馈。

### P0.4 运行时敏感词与 Emoji 审查

现状：

- UI 中有 `✓`、`✕`、`×`、`⌫` 等单色符号。
- 音色分类历史上存在后端 icon 字段渲染风险。
- 策略页仍有 `oracle-card` 类名和视觉残影，类名虽不显示给用户，但会影响后续维护认知。

改进：

- 可见 UI 禁止彩色 Emoji；关闭、确认、删除、返回类图形改为 CSS 线图标或统一 icon view。
- 运行时 WXML、fallback 文案、分享文案、Canvas 海报文字不得出现 AGENTS 敏感词表。
- 策略页类名从 `oracle-card` 迁移为 `strategy-core` / `mission-chip` / `flight-computer`，避免后续继续按旧隐喻设计。

验收：

```bash
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" miniprogram backend/src/main/resources/voices.json
rg -n "oracle|card-stage|抽|占|运势|塔罗|神谕" miniprogram/pages/fortune miniprogram/utils
```

运行时可见文案无风险词；过滤器词表如保留，必须只用于清洗，不进入 UI。

### P0.5 reduce-motion 完整性

现状：

- 主页面多数已有根节点绑定。
- `app.wxss` 有全局 reduce-motion 兜底，但组件内仍有非法 selector。
- 仍有 JS timer / Canvas 动效需要逐个确认是否被守卫。

改进：

- 所有页面根节点统一使用 `{{!animationEnabled ? 'reduce-motion' : ''}}` 或 `reduceMotion`。
- 所有组件接收 `reduceMotion` 属性时必须传递。
- `score-chart`、`radar-chart`、`score-timeline`、`force-graph`、策略生成日志、登录接入动画都必须在关闭动效后直接显示静态状态。

验收：

```bash
rg -n "requestAnimationFrame|setTimeout|setInterval" miniprogram/pages miniprogram/components
rg -n "reduce-motion|reduceMotion|animationEnabled" miniprogram/pages miniprogram/components
```

每个动效源都有关闭路径和清理路径。

## 4. 页面逐项审查

### 4.1 登录页 `pages/login/login`

当前状态：

- 已有「终端接入」「TERMINAL ACCESS」「系统状态」「身份认证」。
- 视觉方向正确，像进入主系统的接入舱。
- 唯一主按钮为 `onLogin`。

交互清单：

- `onLogin`：身份认证。
- `connecting` 动画：接入步骤、`[OK]`、接入完成。

问题：

- Logo 更像抽象发光标记，太空飞机感不够明确。
- 登录按钮仍是独立大按钮，缺少飞控授权条的结构。
- 接入动画使用连续 timer，需要确认关闭动效时是否跳过步骤动画。
- `BUILD 1.0.0` 固定写死，后续可能与版本事实不一致。

改进：

- Logo 改为「舱门锁定环 + 中央 SR 线标」或「HUD 识别环」，减少普通发光球感。
- `身份认证` 按钮改为飞控授权条：左侧小锁线图标，中文居中，右侧 `AUTH` 状态码。
- loading 使用绝对定位扫描点，不移动中文主文案。
- 系统状态三行改成航电自检：空间模块 / 镜像模块 / 策略模块，每行带 `ONLINE` 微标签。
- `reduce-motion` 下点击登录后直接显示静态「正在接入」和最终结果，不逐条延迟。

验收：

- 未登录首屏不出现普通微信授权页感。
- 登录按钮点击前、loading、完成三态无布局跳动。
- 关闭动效后无扫描线、无连续步骤动画。

### 4.2 房间页 `pages/room/room`

当前状态：

- DevTools 已观察到已入空间态：`空间终端 · SPACE`、在线状态、空间识别码、成员 2/16、成员网络、流向日志、空间扫描。
- 方向正确，是当前最接近飞行座舱的页面。
- 页面包含最多功能按钮，是本计划最高优先级页面。

交互清单：

- 登录态：`goLogin`。
- 创建空间：`selectScoreMode`、`selectRoundInputMethod`、`selectTrustMode`、`selectZeroSum`、`selectTimeout`、`selectAutoTimeoutAction`、`createRoom`。
- 接入空间：`scanJoin`、`onTerminalTap`、`onRoomCodeInput`、`onRoomCodeBlur`、`joinByNo`、`onRecentTap`。
- 当前空间快捷入口：`copyRoomNo`、`openShareSheet`、原生 `open-type=share`、`enterRoom`。
- 已入空间：`copyRoomNo`、`openShareSheet`、`startRound`、`onTapMember`、`onSettleTap`、`quitRoom`。
- 封存确认：`closeSettleConfirm`、`confirmSettle`。
- 数值键盘：`closeNumpad`、`onNumpadKey` 0-9、`clear`、`del`、`confirmNumpad`。
- 分享抽屉：`closeShareSheet`、原生分享、`sharePoster`、`copyRoomLink`、`scanJoin`。
- 结算覆盖层：`closeSettleOverlay`。
- 矩阵弹窗：`onMatrixClose`。
- 轮次输入：`onHostFillClose`、`onMemberFillClose`、`confirmRound`、`onRoundConfirmClose`、`onRoundCancel`。
- 重名提示：`closeNameCollisionModal`、`goToProfile`。

问题：

- 未入空间态配置项很多，首屏可能仍像高级表单。
- `开启空间` 文案与系统要求的「启动房间/启动空间」需要统一，建议全项目统一「启动空间」。
- 选择卡、chip、按钮、分享按钮、结算按钮样式不是同一控件系统。
- 数值键盘和成员点击是高频操作，需要更像航电输入面板。
- 危险操作「断开空间 / 封存」需要更强确认层级和红色语义，但不能大红大面积。
- `✓`、`×`、`✕`、`⌫` 等符号应统一为线图标。

改进：

- 未入空间首屏重排为四块：系统状态、空间模式、配置预览、启动/接入。高级选项收进「协议参数」折叠面板。
- 模式选择卡改为两块飞控任务协议：`自由流转` = `FREE FLOW`，`本局录入` = `ROUND LOG`，active 只亮边框和状态点。
- `启动空间` 主按钮改成底部飞控主按钮，loading 时右侧显示小型环形扫描，中文保持绝对居中。
- `接入空间` 输入框改成 6 个独立舱格，自动大写，错误态只红色描边，不出现刺眼红底。
- 最近加入列表改成「最近接入记录」小型数据行，点击态有轻微横向光扫。
- 已入空间顶部状态栏固定为：空间、模式、成员、连接，每项有短标签和数字，不挤压。
- 成员网络：
  - 简易模式 4x4 网格必须支持 16 人，`max-height: 600rpx`，滚动不撑爆首屏。
  - 座位模式使用绝对定位舞台，中央是虚拟桌面参考点，成员像座舱雷达目标环绕。
  - 成员卡 active/owner/我 三种状态用角标和外环，不用大块颜色。
- 数值键盘：
  - 改为「航电输入面板」，顶部显示目标、数值、方向。
  - `C`、删除、确认都用统一图标或短中文，确认按钮 disabled 态必须明显但不跳布局。
  - 点击成员后底部抽屉滑入；reduce-motion 下立即出现。
- 流向日志：
  - `我的视角 / 全域视角` 用统一 `segment-switch`，滑块像航电拨片。
  - 时间轴空状态不要写「记录流已结束」过重，可改「暂无新的流向」。
- 分享抽屉：
  - 二维码区域改为「接入信标」，加载中、失败、重试三态完整。
  - 分享、海报、复制、扫描四按钮使用 2x2 图标矩阵。
- 封存/退出：
  - `onSettleTap` 进入舱门确认弹窗，明确「封存后进入任务档案」。
  - `quitRoom` 文案统一「断开空间」，确认弹窗里说明不删除历史记录。

验收：

- 0 人、2 人、16 人、长昵称、大数字、断线重连、自由流转、本局录入都不溢出。
- 所有高频按钮点击反馈一致。
- 不触发 Console 警告。
- 关闭动效后成员点击、键盘、矩阵、分享、封存确认无过渡等待。

### 4.3 策略页 `pages/fortune/fortune`

当前状态：

- DevTools 观察到标题「今日策略」、日期、中央 `oracle-card`、`点击生成`、人格协议 / 任务镜像 / 历史行为。
- 结果页已有策略主题、核心洞察、行动优势、风险提示、重新生成、分享策略卡。
- 整体方向已从旧功能转向策略终端，但中央视觉仍像卡片。

交互清单：

- `onTapDraw`：生成今日策略。
- `onTapWait`：长耗时继续等待。
- `onTapRetry`：长耗时重新推演。
- `onTapRefresh`：结果页重新生成。
- `onTapShare`：打开策略卡分享。
- `onTapRetryError`：错误态重试。
- `onPosterRetry`、`onPosterCancel`、`onSavePoster`、`onSharePoster`、`onClosePoster`。
- `terminal-popup`：重新生成确认 `onRefreshCancel`、`onRefreshConfirm`。

问题：

- `oracle-card` 类名和视觉会把用户带回卡牌/玄学联想。
- 「点击生成」入口更像抽取，不像飞控计算。
- generating 阶段日志动画多，若耗时长容易像控制台堆字。
- 海报弹层文案「正在生成档案」与策略卡不一致。
- `分享微信` 文案不如「发送策略卡」克制。

改进：

- 将 idle 中央组件改为「飞控策略芯片」：
  - 外层：圆角不超过 24rpx 的任务芯片。
  - 中央：雷达锁定环 + 水平航线刻度。
  - 主文案：`生成策略` 或 `校准今日状态`。
  - 副标签：`FLIGHT COMPUTER` / `STRATEGY CORE`。
- 类名迁移：`oracle-card` -> `strategy-core`，`card-stage` -> `mission-stage`。
- generating 阶段：
  - 四步状态改成航电 checklist：读取人格协议、载入历史行为、计算风险边界、输出行动建议。
  - 日志最多显示 4 行，不做长打字机。
  - 1.5 秒显示「推演中」，8-10 秒给「继续等待 / 重新推演」。
- success 阶段：
  - `策略主题` 保留，但卡片应像任务简报，不像玻璃海报。
  - 行动优势和风险提示使用编号向量 `01 / 02 / 03`，颜色克制。
- 海报：
  - `正在生成档案` 改为 `正在生成策略卡`。
  - `分享微信` 改为 `发送策略卡`。
  - 图片保存失败、授权失败、生成失败都有短提示。
- 敏感词：
  - LLM 返回内容、fallback、poster canvas 全部走过滤。
  - 命中过滤词直接丢弃并用安全 fallback。

验收：

- 策略页不出现卡牌、抽取、神秘仪式感。
- 断网、超时、生成失败、海报失败每个状态都有 UI 反馈。
- reduce-motion 下没有长日志动画，直接展示静态进度或结果。

### 4.4 镜像页 `pages/mirror/index`

当前状态：

- DevTools 观察到「人格协议」「任务镜像」「人格可信度」「人格偏差」「系统判读」「人格信号」「人格演化」「生成档案」。
- 数据舱感强，雷达图方向正确。
- 信息密度较高，按钮普通矩形感仍存在。

交互清单：

- `startMbtiTest`：认知校准 / 重新校准。
- `openMbtiPicker`：直接选择 / 人格重构。
- `generateDossier`：生成档案。
- `mbti-swipe-test`：`closeMbtiTest`、`handleMbtiComplete`。
- `mbti-picker-modal`：`closeMbtiPicker`、`handleMbtiDirectInput`。
- `terminal-popup`：`onExitCancel`、`onExitConfirm`。

问题：

- 未校准文案中仍有「博弈人格模型」，建议改为更安全的「行为人格模型」。
- `重新校准 / 人格重构` 按钮像普通小按钮，缺少飞控拨片感。
- 底部固定「生成档案」按钮与页面内容之间视觉关系强，但可更像飞控主控条。
- 可信度 checklist 使用 `✓ / —`，需统一线图标或状态点。

改进：

- 顶部协议卡改为「身份协议模块」：
  - `SR-MBTI-ESTJ` 使用等宽字体。
  - 状态 `已同步` 用绿色小灯。
  - 操作按钮为 `校准协议` / `修订协议`，中文主文案更准确。
- 雷达区：
  - 保持核心视觉，增加五维轴标签防重叠规则。
  - 低样本锁定态像「雷达未解锁」，不是普通进度条。
- 系统判读：
  - 长段改为 4 个短任务卡：观测、偏差、风险、建议。
  - 每段 50 字以内，超出折叠或省略。
- 固定底部按钮：
  - 改为座舱底部主控条，左侧 `DOSSIER`，中间「生成档案」，右侧箭头图标。
  - 避免遮挡 iPhone 底部 TabBar。
- 所有校准弹窗打开/关闭 respect reduce-motion。

验收：

- 未校准、已校准、样本不足、样本足够四态都清晰。
- 每个按钮 active/loading/success/error 视觉统一。
- 雷达 tooltip 不被底部按钮遮挡。

### 4.5 MBTI 滑动测试组件 `components/mbti-swipe-test`

交互清单：

- `onClose`：关闭测试。
- `onSwipeLeft`：否定。
- `onNotSure`：跳过。
- `onSwipeRight`：认同。

问题：

- 底部三个动作像卡片选择器，航空座舱感不足。
- 题目卡片存在「滑卡」联想，容易靠近抽卡体验。

改进：

- 改成「信号判断面板」：左侧 `否定`、中间 `跳过`、右侧 `认同`，三个按钮像三段控制杆。
- 题目卡片改为扫描面板，四角细线、中央问题，不做大幅飞出动画。
- 关闭时弹出统一 `terminal-popup`，未保存说明清楚。

验收：

- 20 题进度条稳定，不因题目长短跳动。
- reduce-motion 下不滑动飞出，只切换内容。

### 4.6 MBTI 直接选择组件 `components/mbti-picker-modal`

交互清单：

- `onClose`。
- `onDimSelect` 四组维度选择。
- `onConfirm` 同步人格协议。
- `cancelExit`、`confirmExit`。

问题：

- 当前是编辑器感，方向基本可用。
- 同步动画和退出确认是组件内自定义样式，应与 `terminal-popup` 统一。
- `✓ 人格协议已更新` 使用文本符号。

改进：

- 四组维度按钮改成 `flight-chip`，active 为蓝色边框 + 小状态点。
- 同步按钮保持中文居中，loading 环绝对定位。
- 退出确认直接复用 `terminal-popup` 风格或抽取同一 token。
- 成功态使用绿色状态点和「已更新」，不依赖 `✓` 字符。

验收：

- 维度选择不溢出。
- 关闭未保存时只出现一次确认，不连环弹。
- 同步失败可重试，按钮不死锁。

### 4.7 镜像档案页 `pages/mirror-dossier/mirror-dossier`

当前状态：

- 页面为档案型长文，包含人格协议、可信度、任务画像、人格偏差、系统判读、人格信号、操作按钮。

交互清单：

- `openCardPanel`：打开档案卡生成面板。
- `copyDossier`：复制文字。
- `generateCard`：生成预览。
- `closeCardPanel`：关闭面板。
- `closeCardPreview`：关闭预览。
- `saveCard`：保存到相册。
- 原生 `open-type=share`：分享给朋友。

问题：

- 档案页比镜像页更像报告，太空座舱感偏弱。
- 底部操作面板「档案卡生成」像普通分享面板。
- 预览关闭按钮是 `x` 文本。

改进：

- 页面标题改成「人格档案」+ `DOSSIER`，保持，但每个 section 增加左侧细竖线或编号，使其像档案舱格。
- 操作按钮改成两段：主操作「生成档案卡」、次操作「复制文字」，同一控件体系。
- 底部面板改为「档案输出舱」：
  - `生成预览` 为主按钮。
  - `复制文字` 为次按钮。
  - `取消` 为 ghost。
- 预览弹窗：
  - 关闭使用 CSS 线图标。
  - 保存与分享按钮并排，长文案不挤压。
  - 保存授权失败给出短提示。

验收：

- 生成中、生成失败、预览、保存失败、分享五态完整。
- 生成图片不含敏感词，不含彩色 Emoji。

### 4.8 身份页 `pages/profile/profile`

当前状态：

- DevTools 观察到「身份终端」「身份档案」「数据矩阵」「身份等级」「成就记录」「系统控制」。
- Avatar 已是头盔视觉，方向正确。
- 成就记录横滑密度高，系统控制仍有设置页气味。

交互清单：

- `goLogin`。
- `chooseAvatar` / `onChooseAvatar`。
- `onNicknameInput`。
- `shuffleNickname`。
- `goScoreRecords`。
- `onVoiceToggle`。
- `openVoiceSheet`。
- `onAnimToggle`。
- `onVibrateToggle`。
- `goAbout`。
- `onLogout`。
- `closeVoiceSheet`。
- `onCatTap`。
- `onVoiceTap`。

问题：

- 头像按钮只有图片区域，缺少「编辑身份」语义。
- 随机昵称按钮需要统一 icon，不应像普通小方块。
- 数据矩阵中「胜率」重复显示，需检查字段标签。
- 成就横滑卡过多，阅读负担大。
- `TERMINATE 断开终端` 危险操作在底部，但需要更明确二次确认。
- 声音、动效、触感开关缺少航电开关语义。

改进：

- 身份档案：
  - 头像按钮增加线框编辑角标，文案可见区域不变。
  - 昵称输入像身份代号槽，保存中显示小型同步点。
  - 随机昵称按钮改为 `flight-icon random`，带 tooltip 式弱文案「生成代号」。
- 数据矩阵：
  - 四格固定等宽等高，长数字用等宽字体。
  - 修正重复标签，明确「净数值 / 反馈率或正向率 / 任务数 / 稳定性」。
- 成就：
  - 横滑区域首屏只露出 2.2 张，强调可滑。
  - 已解锁、进度、锁定三态用边框和状态点，不堆满数字。
- 系统控制：
  - 改为「航电控制」：声音协议、音色选择、动效协议、触感协议、终端信息。
  - 开关统一 `ARMED/SAFE` 或 `ON/OFF`，但中文标题必须主导。
  - 音色选择 row 只有声音开启时显示，出现/消失 reduce-motion 下无动画。
- 断开终端：
  - 使用 `flight-danger`，点击后统一 terminal-popup，说明退出不会删除历史数据。

验收：

- 长昵称、头像缺失、未登录、保存中、保存失败、音色播放中都不破版。
- 身份页不再像设置页首页，设置感降级到二级控制区。

### 4.9 设置页 `pages/settings/settings`

当前状态：

- 页面只有「语音与反馈」设置卡，普通设置页感明显。
- 与身份页系统控制存在重复功能。

交互清单：

- `onVoiceToggle`。
- `openVoiceSheet`。
- `onAnimationToggle`。
- `onVibrateToggle`。
- `closeVoiceSheet`。
- `onCatTap`。
- `onVoiceTap`。

问题：

- `glass-card settings-card` 仍像传统设置。
- 标题不符合「身份终端 / 设置中心」二级页定位。
- 开关样式与身份页开关需要统一。

改进：

- 页面定位为「控制中心」或「系统控制」，顶部增加 `CONTROL CENTER` 弱标签。
- 三个开关复用身份页航电开关。
- 音色抽屉复用同一套组件或至少同一套样式 token。
- 设置页只保留二级详细配置，不再承担身份页首页功能。

验收：

- 身份页和设置页同一功能状态一致。
- 切换设置后返回房间页、策略页、镜像页，动效/声音/触感立即生效。

### 4.10 音色选择页 `pages/voice-select/voice-select`

当前状态：

- 已有底部抽屉、分类侧栏、音色列表。
- 根节点已接入 reduce-motion。

交互清单：

- `closeSheet`。
- `switchTab`。
- `playVoice`。

问题：

- `{{item.icon}}` 直接渲染后端 icon，有彩色 Emoji 风险。
- 分类栏像普通 App 侧边栏，不够座舱频道选择。
- 播放中使用旋转 icon，关闭动效时需确认静态状态。

改进：

- 后端 `icon` 不直接渲染，前端根据分类 id 映射 CSS 线图标或字母代码。
- 分类栏改为「声道频道」：女声 / 男声 / 效果音等，active 为左侧蓝线 + 状态点。
- 音色卡显示：名称、描述、语速/风格标签、播放状态。
- 播放试听必须单例音频，点击新音色执行 `stop -> src -> play`。
- 选中态和播放态分离：选中用绿色状态点，播放用青色波形。

验收：

- 无 Emoji。
- 快速连续点击多个音色不会重叠播放。
- 返回上一页后音频停止或状态复位。

### 4.11 结算档案页 `pages/settle/settle`

当前状态：

- 页面展示任务档案、实时序列、任务复盘、数值演化轨迹、数值关系网络、行为信号。
- 主要是展示页，按钮少，交互来自图表和网络组件。

交互清单：

- `score-chart` 触控。
- `score-network` 展开/收起、节点点击、详情关闭。

问题：

- `实时序列` 命名在结算后不够准确，可改为「最终序列」或「封存序列」。
- 排名视觉不能变成竞技榜单或财富暗示，应保持任务档案语气。
- 图表与网络需要统一雷达/航线视觉。

改进：

- 标题区保持 `任务档案`，增加「封存时间 / 空间识别码」状态条。
- 排名区改为「封存序列」，第一名不使用夸张冠军光效。
- 复盘指标保持冷静：峰值流向、总流量、交互次数、成员数。
- 行为信号每条限制短文案，避免 AI 长解释。

验收：

- 2 人、16 人、大分数、头像缺失、无图表数据都可读。
- 触控图表 tooltip 不遮挡底部。

### 4.12 脉冲日志页 `pages/score-records/score-records`

当前状态：

- 页面有 `脉冲日志`、近期净数值、采样状态、曲线解锁、任务档案列表。

交互清单：

- `onPullDownRefresh`。
- `onRoomTap`。

问题：

- 空状态重复「暂无任务档案」。
- `RESULT / 任务结果` 可能偏胜负榜单，需要改为「封存摘要」。
- 列表卡片需要更像飞行记录，而不是普通历史列表。

改进：

- 空状态：`暂无封存记录` + `完成一次空间封存后写入日志`。
- 列表卡改为「飞行记录条」：
  - 左上 `SR-XXXXXX`，右上时间。
  - 中间显示本人净数值和成员数。
  - 底部 `查看任务档案` + 线箭头。
- 下拉刷新使用小型雷达扫描，不用大旋转 loading。

验收：

- 下拉刷新期间列表不跳动。
- 点击记录进入结算档案，返回后保持滚动位置。

## 5. 共享组件逐项审查

### 5.1 `terminal-popup`

用途：

- 策略重新生成确认。
- 镜像退出确认。
- 后续应复用到退出、封存、放弃修改、删除类确认。

问题：

- 当前标题区 `title/subtitle` 命名与视觉顺序容易混乱。
- 按钮样式需要支持 primary / danger / secondary 的全局标准。

改进：

- 统一为：`kicker` 英文弱标签、`title` 中文标题、`content` 主说明。
- 支持 `danger` 类型时红色描边、透明底。
- 关闭遮罩点击是否关闭由调用方明确传入，危险确认默认不点遮罩关闭。

验收：

- 房间封存、退出终端、策略刷新、MBTI 放弃修改都复用同一视觉。

### 5.2 `helmet-avatar`

用途：

- 成员头像、身份头像、矩阵关系头像。

问题：

- DevTools 当前有非法 selector 和 `src=null` 警告。

改进：

- P0 修 selector 和 src。
- 头像 active/owner/me/controller 状态用外环、角标、状态点表达。
- 不依赖 box-shadow 叠很多层，低端机滚动不卡。

验收：

- 房间 16 人同时显示头像无明显卡顿。
- 无组件警告。

### 5.3 `segment-switch`

用途：

- 流向日志「我的视角 / 全域视角」。

问题：

- 当前是普通双段滑块。

改进：

- 改为航电拨片：底轨暗色，滑块蓝色细框，active 文案白，inactive 文案灰。
- 支持宽文本不溢出。
- 支持 `reduce-motion` 时滑块瞬移。

验收：

- 可复用于后续设置、筛选、图表维度切换。

### 5.4 `flow-log-panel`

用途：

- 房间页流向日志，包含分段切换和矩阵入口。

问题：

- 空状态和结束态文案需要更克制。
- 矩阵入口要像雷达按钮，不像普通文本按钮。

改进：

- 矩阵入口使用小型 `flight-icon radar` +「总览」。
- 日志条按时间、方向、数值分三列，长昵称截断。
- 正负颜色不要过饱和。

验收：

- 大量记录滚动无卡顿。
- 加载更多不影响当前滚动位置。

### 5.5 `space-scan-panel`

用途：

- 房间页空间扫描：活跃目标、峰值流向、流转总量、连接密度。

问题：

- 当前方向正确，应继续做成飞行仪表。

改进：

- 指标统一四宫格，标题中文 + 英文代码。
- 密度条使用航线刻度，不使用普通进度条。
- `高/中/低` 状态对应颜色但不大面积填充。

验收：

- 0 记录、低样本、大数字都显示稳定。

### 5.6 `matrix-overview`

用途：

- 数值总览、关系明细、嵌入 `score-chart`。

问题：

- 弹窗层级复杂，Canvas 穿透风险已被部分处理。
- 关闭按钮使用 `✕`。
- 头像 src 可能传 null。

改进：

- 关闭按钮统一 CSS 线图标。
- 关系明细像「航线详情」：双方头像、连线、净数值、事件列表。
- `relation-scroll` 分页加载要有底部 loading / end 状态。
- 打开明细时隐藏图表 Canvas 保留。

验收：

- 打开总览、点击成员、打开明细、关闭明细、关闭总览全流程不穿透、不抖动。

### 5.7 `host-fill-modal` / `member-fill-modal`

用途：

- 本局录入模式主控填写与成员自填。

问题：

- 当前像普通表单弹窗。
- `确认提交` 是普通按钮，且 loading/disabled 状态需统一。

改进：

- 改为「本轮输入面板」：
  - 顶部：`ROUND INPUT` + 中文标题。
  - 输入行：成员名、头像/代号、数值输入槽。
  - 零和模式合计条固定底部。
- 主控填写的成员列表滚动区域最大高度，16 人不撑爆。
- 成员自填提交后显示「已提交，可修改」并保留修改入口。
- 输入框支持负数、清空、错误态提示。

验收：

- 主控 16 人录入不遮挡确认按钮。
- 零和失败时不关闭弹窗，错误说明可见。

### 5.8 `round-confirm-modal` / `round-status-bar`

用途：

- 轮次确认、同意、异议、取消。

问题：

- `有异议 / 同意` 按钮需要和全局 danger/primary 对齐。
- `取消` 在状态条中太普通，需要明确是主控操作。

改进：

- 确认弹窗改为「轮次封存确认」。
- 明细列表每人一行，状态点：已确认 / 等待 / 未录入。
- `有异议` 为橙色或红色次危险按钮，`同意` 为主按钮。
- 状态条点击打开详情，取消按钮用小型 danger chip。

验收：

- 待确认、已确认、驳回、取消、超时自动同意/取消全部可区分。

### 5.9 `score-network`

用途：

- 结算页数值关系网络。

问题：

- `展开/收起`、节点详情、关闭按钮样式需要统一。
- 关系网络需要避免像社交关系图，保持数据航线感。

改进：

- 展开按钮改为小型舱内折叠拨片。
- 节点详情浮层使用 HUD 小面板。
- 关闭使用 CSS 线图标。
- 连线颜色按净方向弱化，避免红绿过强。

验收：

- 节点多时不重叠到不可读。
- 点击节点详情不遮挡关键图形。

### 5.10 图表组件：`radar-chart` / `score-chart` / `yield-chart` / `score-timeline` / `force-graph`

用途：

- 人格雷达、数值曲线、日志曲线、力导向图。

问题：

- 动效和触控多，必须严守性能。
- Tooltip 需要统一 HUD 样式。

改进：

- Canvas 初始绘制必须有空态，不允许白屏。
- reduce-motion 下不扫线、不脉冲、不 requestAnimationFrame。
- touchmove 做节流，且页面滚动不 setData。
- Tooltip 统一为小型黑底蓝边 HUD，不遮挡轴标签。
- 图表颜色控制在蓝/青/绿/红/灰，不新增随机色彩。

验收：

- iPhone 14 Pro Max、较小屏、16 人数据都能读。
- 连续切页后 timer / animation frame 不泄漏。

### 5.11 `battle-summary` / `persona-signal` / `settle-table`

用途：

- 结算复盘、行为信号、表格。

问题：

- 复盘模块容易变成数据堆砌。

改进：

- 使用「任务复盘」语气，不做胜负煽动。
- 表格固定首列和数字列的阅读层级。
- 信号条只显示 3-5 个高价值指标，低样本时明确标注。

验收：

- 每个指标有中文主标签和英文弱标签。
- 长昵称、大数值不撑破表格。

## 6. P1 执行顺序

1. 清 DevTools P0：头像组件非法 selector、`src=null`、timeout。
2. 抽取全局控件 token：按钮、chip、switch、icon、modal、drawer。
3. 房间页控件统一：创建/接入/成员/键盘/分享/封存。
4. 策略页隐喻迁移：去掉卡牌感，改飞控策略芯片。
5. 身份页与设置页开关统一：航电控制样式。
6. 镜像页按钮与弹窗统一：校准、协议编辑、生成档案。
7. 二级页统一：音色、日志、结算、档案分享。
8. 图表和组件 reduce-motion / tooltip / close icon 统一。

## 7. P2 组件化收敛

建议新增或抽取的轻量原生组件，不引入框架：

- `flight-button`：主/次/危险/ghost/loading。
- `flight-chip`：单选、多选、小型参数。
- `flight-switch`：声音、动效、触感统一航电开关。
- `flight-icon`：关闭、复制、分享、扫描、删除、随机、箭头。
- `flight-drawer`：音色、分享、输入、档案输出统一底部抽屉。
- `flight-section-head`：中文标题 + 英文弱标签 + 细线。

抽取原则：

- 只抽重复 3 次以上且行为一致的控件。
- 不把业务逻辑搬进通用组件。
- 不新增构建依赖。
- 保留现有页面结构，逐步替换。

## 8. 微信开发者工具逐页验收清单

每轮执行后在微信开发者工具中按此清单验收：

### 主 Tab

- 空间页：
  - 未登录。
  - 已登录无空间。
  - 创建自由流转。
  - 创建本局录入。
  - 接入识别码错误。
  - 接入识别码正确。
  - 已入空间 2 人。
  - 已入空间 16 人模拟数据。
  - 数值键盘。
  - 分享抽屉。
  - 矩阵总览。
  - 封存确认。
  - WS 重连遮罩。
- 策略页：
  - idle。
  - generating 1.5 秒后。
  - timeout warning。
  - timeout critical。
  - success。
  - error。
  - poster generating。
  - poster preview。
  - poster error。
  - 重新生成确认。
- 镜像页：
  - loading skeleton。
  - 未校准。
  - 已校准低样本。
  - 已校准雷达解锁。
  - MBTI 滑动测试。
  - MBTI 直接选择。
  - 退出确认。
  - 生成档案按钮。
- 身份页：
  - 未登录。
  - 已登录头像缺失。
  - 修改头像。
  - 修改昵称。
  - 随机代号。
  - 查看日志。
  - 声音/动效/触感开关。
  - 音色抽屉。
  - 断开终端确认。

### 二级页

- 设置页：三开关、音色抽屉、关闭抽屉。
- 音色选择页：分类切换、试听、选中、关闭。
- 脉冲日志页：空状态、锁定曲线、已解锁曲线、点击记录。
- 结算页：加载、封存序列、图表、网络展开、节点详情。
- 镜像档案页：档案卡面板、生成预览、保存、分享、复制、关闭。

## 9. 命令验收清单

交互覆盖：

```bash
rg -n 'bindtap="[^"]+"|catchtap="[^"]+"|bindinput="[^"]+"|open-type="[^"]+"|bind:confirm="[^"]+"|bind:cancel="[^"]+"|bindtouch' miniprogram/pages miniprogram/components
```

禁用彩色 Emoji：

```bash
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" miniprogram backend/src/main/resources/voices.json
```

运行时敏感文案：

```bash
rg -n "运势|占卜|塔罗|抽牌|神谕|赌|下注|押注|筹码|牌局|牌桌|打牌|麻将|扑克|赢钱|赚钱|发财|稳赚|必胜|翻本|追损|算命|黄历|风水|开运|转运|改运|预测输赢" miniprogram
```

动画规范：

```bash
rg -n "transition:\s*all|requestAnimationFrame|setInterval|setTimeout" miniprogram/pages miniprogram/components
```

reduce-motion 覆盖：

```bash
rg -n "reduce-motion|reduceMotion|animationEnabled" miniprogram/pages miniprogram/components miniprogram/app.wxss
```

组件 WXSS 非法 selector：

```bash
rg -n "(^|,)\s*(view|text|image|button|scroll-view|canvas|input|textarea)(\s|\.|#|\[|,|$)" miniprogram/components/**/*.wxss
```

DevTools 业务错误：

- Console 中业务 error 为 0。
- 组件 warning 为 0。
- 允许微信基础库灰度、自动热重载等工具级提示单独记录，但不得有项目代码 warning。

## 10. 完成定义

完成后必须满足：

- 所有页面主视觉统一为黑底、蓝/青细线、飞控座舱、任务终端。
- 所有按钮、开关、chip、弹窗、抽屉有统一控件语法。
- 策略页不再有卡牌/玄学隐喻。
- 身份页不再像传统设置页，设置降级到系统控制二级入口。
- 房间页高频操作像记录空间的控制台，不像普通表单。
- 所有动画支持 reduce-motion。
- DevTools 无业务 error / 组件 warning。
- 微信审核高风险可见文案清零。
- 16 人、长昵称、大数字、弱网、空数据、失败态都不破版。
