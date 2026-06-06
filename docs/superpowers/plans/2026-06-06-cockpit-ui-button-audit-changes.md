# 太空座舱 UI 计划执行改动报告

> 生成日期：2026-06-06  
> 对应计划：`docs/superpowers/plans/2026-06-06-cockpit-ui-button-audit.md`  
> 执行前基线提交：`00ebc12 chore: checkpoint cockpit UI audit baseline`

## 1. 执行情况

已按要求在执行前提交整个项目到 Git：

```bash
git add -A
git commit -m "chore: checkpoint cockpit UI audit baseline" ...
```

随后调用了命令行 `claude` agent，并在 prompt 中要求其阅读本计划、开启多个子 agent 分工执行和测试。该命令以非交互 `claude -p` 方式运行，期间没有流式输出，运行较久后被用户中断。中断前 `claude` 已经对 25 个前端文件产生了改动，但没有按要求生成本报告文件。为避免后台继续无反馈写入，已手动停止残留 `claude` 进程，并由当前线程接管验证、少量修正和报告生成。

因此，本报告记录的是当前工作区中实际存在的改动，而不是 `claude` 内部子 agent 的完整日志。是否确实启动了多个内部子 agent，无法从中断后的输出中验证。

## 2. 实际修改文件

本轮执行后，相对基线提交 `00ebc12` 修改了以下文件：

```text
miniprogram/app.wxss
miniprogram/components/helmet-avatar/index.wxss
miniprogram/components/matrix-overview/matrix-overview.wxml
miniprogram/components/matrix-overview/matrix-overview.wxss
miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxml
miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxss
miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxml
miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxss
miniprogram/components/mirror-mbti-card/mirror-mbti-card.wxml
miniprogram/components/round-status-bar/round-status-bar.wxml
miniprogram/components/score-network/score-network.wxml
miniprogram/components/score-network/score-network.wxss
miniprogram/pages/fortune/fortune.wxml
miniprogram/pages/fortune/fortune.wxss
miniprogram/pages/login/login.wxml
miniprogram/pages/mirror-dossier/mirror-dossier.wxml
miniprogram/pages/mirror-dossier/mirror-dossier.wxss
miniprogram/pages/mirror/index.wxml
miniprogram/pages/mirror/index.wxss
miniprogram/pages/profile/profile.wxml
miniprogram/pages/room/room.js
miniprogram/pages/room/room.wxml
miniprogram/pages/room/room.wxss
miniprogram/pages/score-records/score-records.wxml
miniprogram/pages/settle/settle.wxml
miniprogram/project.config.json
miniprogram/minitest/test.config.json
docs/superpowers/plans/2026-06-06-cockpit-ui-button-audit-changes.md
```

变更规模：

```text
前端样式/页面代码：26 files changed, 540 insertions(+), 129 deletions(-)
新增报告文件：365 lines
新增小程序测试配置：miniprogram/minitest/test.config.json
```

## 3. 对应计划完成情况

### P0.1 helmet-avatar 非法选择器

状态：已完成。

实际改动：

- 将 `miniprogram/components/helmet-avatar/index.wxss` 中的小程序组件非法选择器：
  - `.reduce-motion view`
  - `.reduce-motion image`
- 改成类选择器：
  - `.ha.reduce-motion .ha__glow`
  - `.ha.reduce-motion .ha__img`
  - `.ha.reduce-motion .ha__shell`
  - `.ha.reduce-motion .ha__visor`
  - `.ha.reduce-motion .ha__reflection`
  - `.ha.reduce-motion .ha__frame`

验证结果：

- 组件 WXSS 非法 tag selector 检查无命中。

### P0.2 头像 src=null 警告

状态：部分完成。

实际改动：

- 房间成员头像、转移面板源成员/目标成员头像改为 `avatarUrl || ''`。
- 身份页头像改为 `avatarUrl || ''`。
- 矩阵总览和明细头像改为 `avatarUrl || ''`。

仍需复核：

- `score-network`、`score-records`、`settle` 中普通 `<image wx:if="{{avatarUrl}}">` 不属于 `helmet-avatar` 组件 property 警告，保留原逻辑。
- 需要在微信开发者工具中重新进入房间页、身份页、矩阵弹窗确认 Console 不再出现 `expected <String> but get null`。

### P0.3 Error: timeout

状态：未完成。

说明：

- 当前 diff 没有新增接口耗时定位、timeout fallback 或日志降噪。
- 因 `claude` 被中断且未生成调试记录，无法判断此前 DevTools `Error: timeout` 的来源。

下一步：

- 在 DevTools Console 复现冷启动、主 Tab 切换、进入房间、打开策略页和身份页。
- 对登录、房间初始化、策略生成、二维码获取、音色加载、镜像档案加载加短期耗时日志。
- 找到来源后做页面内 fallback。

### P0.4 敏感词与 Emoji

状态：基本完成。

实际改动：

- 清理了运行时 WXML 中剩余的 `✓` 视觉符号：
  - 策略生成 checklist 改为 CSS 状态点。
  - 房间录入方式已启用状态改为 CSS 状态点。
  - MBTI picker 成功态去掉 `✓` 文本。
  - 镜像可信度 checklist 改为状态点。
- 将多个关闭按钮从 `x / × / ✕` 文本改为 CSS 线图标。

验证结果：

- 彩色 Emoji / 符号范围检查无命中。
- 敏感词检查仅剩 `miniprogram/pages/fortune/fortune.js` 中的过滤替换表，例如 `[/运势/g, '状态']`，这些是安全清洗规则，不是可见 UI 输出。

### P0.5 reduce-motion

状态：部分完成。

实际改动：

- 房间页根节点补回 `{{!animationEnabled ? 'reduce-motion' : ''}}`。
- 头像组件 reduce-motion selector 修复。
- 全局控件新增 token 中包含 reduce-motion 兜底依赖。

仍需复核：

- `fortune.js`、`login.js`、`mbti-picker-modal.js` 仍有多个 `setTimeout` 链。
- 图表组件仍需逐项确认关闭动效时是否不创建动画帧。

### P1 全局控件 token

状态：已初步完成。

实际改动：

- 在 `miniprogram/app.wxss` 新增飞控座舱全局 token：
  - `.flight-primary`
  - `.flight-secondary`
  - `.flight-danger`
  - `.flight-chip`
  - `.avionics-switch`
  - `.fi`
  - `.fi--close`
  - `.flight-bottom-bar`
  - `.terminal-overlay`
  - `.terminal-modal`

说明：

- 当前只是第一版全局样式 token，尚未全面替换所有页面控件。
- 需要继续把页面局部按钮逐步迁移到同一 token。

### P1 房间页

状态：部分完成。

实际改动：

- 文案从「开启空间」统一为「启动空间」。
- 创建成功 toast 从「空间已开启」改为「空间已启动」。
- 房间页根节点补齐 reduce-motion。
- 成员头像和转移面板头像做 `avatarUrl || ''`。
- 分享抽屉、结算覆盖层关闭按钮改为 `.fi.fi--close`。
- 录入方式选中勾号改为状态点。

仍需完成：

- 未入空间态高级选项折叠。
- 数值键盘完整航电面板改造。
- 分享抽屉 2x2 图标矩阵与二维码失败重试态。
- 封存/退出统一 terminal-popup。

### P1 策略页

状态：部分完成。

实际改动：

- `card-stage` 改为 `mission-stage`。
- `oracle-card` 改为 `strategy-core`。
- idle 文案从「点击生成」改为「校准今日状态」。
- 结果页按钮使用 `.flight-secondary` / `.flight-primary`。
- 「重新生成」改为「重新推演」。
- 「分享策略卡」改为「发送策略卡」。
- 海报生成文案从「正在生成档案...」改为「正在生成策略卡...」。
- 重新生成确认弹窗文案改为「重新推演」。
- 策略生成 checklist 状态从文本符号改为 CSS 状态点。

仍需完成：

- 中央视觉还只是类名和文案迁移，尚未完整重做为飞控策略芯片。
- generating 日志仍需限制为更短的航电 checklist。
- timeout 源头和 fallback 尚未完成。

### P1 镜像页与 MBTI 组件

状态：部分完成。

实际改动：

- 「博弈人格模型」改为「行为人格模型」。
- 未校准主按钮从「认知校准」改为「启动校准」。
- 已校准操作从「重新校准 / 人格重构」改为「校准协议 / 修订协议」。
- 已校准小按钮套用 `.flight-secondary`。
- 可信度 checklist 改为状态点。
- 固定底部生成档案按钮改为 `dossier-bar` + `.flight-primary`。
- MBTI picker / swipe test 关闭按钮改为 CSS 线图标。
- MBTI picker 成功态移除 `✓` 字符。
- `mirror-mbti-card` 文案也做了按钮语义轻量调整。

仍需完成：

- MBTI 直接选择的退出确认还未真正统一到 `terminal-popup`。
- MBTI 滑动测试还未完全改成三段航电控制杆。
- 雷达低样本锁定态和 tooltip 还需视觉复核。

### P1 身份页、设置页、音色页

状态：少量完成。

实际改动：

- 身份页头像 `avatarUrl || ''`。
- 随机昵称按钮改为 `.fi.fi--random` 方向。

仍需完成：

- 身份页/设置页开关还未替换为 `.avionics-switch`。
- 音色页分类 icon 直渲染风险本轮未进一步改动。
- 设置页仍需要从普通设置卡升级为控制中心。

### P1 结算页与日志页

状态：少量完成。

实际改动：

- 结算页、日志页若干可见文案做了终端语义轻量替换。
- 关闭/详情入口方向向飞控线图标靠拢。

仍需完成：

- 结算页「实时序列」到「封存序列」的完整语义收敛需要继续检查。
- 日志页空状态和列表卡还需要更系统地重构为飞行记录条。

### 共享组件

状态：部分完成。

实际改动：

- `matrix-overview` 关闭按钮改 CSS 图标，头像兜底。
- `score-network` 节点详情关闭按钮改 CSS 图标。
- `round-status-bar` 有轻量文案/按钮调整。
- `mbti-picker-modal` / `mbti-swipe-test` 关闭按钮改 CSS 图标。

仍需完成：

- `terminal-popup` 本体尚未重构为全局控件 token。
- `host-fill-modal` / `member-fill-modal` 本轮未改。
- `segment-switch`、`flow-log-panel`、`space-scan-panel` 本轮未完整改。

## 4. 测试与检查结果

### 后端编译

命令：

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

结果：通过。

### 前端构建脚本

检查：

```bash
find . -maxdepth 3 -name package.json -print
```

结果：未发现 `package.json`，没有 npm 构建脚本可运行。前端仍需在微信开发者工具中编译验收。

### 小程序测试配置

`claude` 中断前新增了微信小程序测试根目录配置：

```text
miniprogram/project.config.json
miniprogram/minitest/test.config.json
```

具体内容：

- `project.config.json` 新增 `testRoot: "minitest/"`。
- `packOptions.ignore` 新增 `/minitest`，避免测试目录进入打包。
- `minitest/test.config.json` 当前为空测试树：`{"treeData":[]}`。

该配置未执行到真正的小程序自动化测试用例，只是留下了测试目录骨架。

### 彩色 Emoji / 符号检查

命令：

```bash
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" miniprogram backend/src/main/resources/voices.json
```

结果：无命中。

### transition: all / 旧策略类名 / 组件非法 selector

命令：

```bash
rg -n "transition:\s*all|oracle-card|card-stage|\.reduce-motion (view|image|text|button|scroll-view|canvas|input|textarea)" miniprogram/pages miniprogram/components miniprogram/app.wxss
```

结果：

- 未命中 `transition: all`。
- 未命中 `oracle-card` / `card-stage`。
- 仅命中 `miniprogram/app.wxss` 的全局 reduce-motion tag selector。该规则位于全局 WXSS，非组件 WXSS，符合当前计划中「全局兜底允许，组件内禁止」的判断。

组件 WXSS 复查：

```bash
rg -n "(^|,)\s*(view|text|image|button|scroll-view|canvas|input|textarea)(\s|\.|#|\[|,|$)|\.reduce-motion (view|image|text|button|scroll-view|canvas|input|textarea)" miniprogram/components/**/*.wxss
```

结果：无命中。

### 敏感词检查

命令：

```bash
rg -n "运势|占卜|塔罗|抽牌|神谕|赌|下注|押注|筹码|牌局|牌桌|打牌|麻将|扑克|赢钱|赚钱|发财|稳赚|必胜|翻本|追损|算命|黄历|风水|开运|转运|改运|预测输赢" miniprogram
```

结果：

```text
miniprogram/pages/fortune/fortune.js:9:  [/运势/g, '状态'],
miniprogram/pages/fortune/fortune.js:10:  [/翻本/g, '修正'],
miniprogram/pages/fortune/fortune.js:12:  [/追损/g, '连续修正'],
miniprogram/pages/fortune/fortune.js:15:  [/必胜/g, '稳定执行'],
miniprogram/pages/fortune/fortune.js:16:  [/稳赚/g, '稳态执行'],
```

解释：这些命中位于策略页敏感词清洗表，目的是把高风险词替换为安全词，不属于运行时可见输出。

## 5. 未完成与风险

- `claude -p` 非交互运行无流式输出，用户中断前已经修改文件但没有完成报告；本报告由当前线程补齐。
- 无法验证 `claude` 是否真的启动了多个内部子 agent，只能确认它执行了实际代码改动。
- DevTools 视觉复核尚未重新跑，尤其需要确认 Console 中的 `Error: timeout` 是否还存在。
- 身份页/设置页航电开关、音色页分类 icon 风险、房间页键盘/分享/封存完整飞控化仍未彻底完成。
- 新增全局 token 后，部分页面只做了局部替换，后续需要继续统一，避免新旧按钮样式并存时间过长。

## 6. 下一步建议

1. 先在微信开发者工具重新编译并切换主 Tab，确认 Console 是否清掉 `helmet-avatar` 警告。
2. 复现并定位 `Error: timeout`，这是当前 P0 中唯一明确未完成项。
3. 第二轮集中处理身份页/设置页/音色页，把 `.avionics-switch` 真正替换进去。
4. 第三轮处理房间页高频操作：数值键盘、分享抽屉、封存确认、轮次录入弹窗。
5. 第四轮处理策略页视觉核心，将 `strategy-core` 从类名迁移升级为真实飞控策略芯片。
