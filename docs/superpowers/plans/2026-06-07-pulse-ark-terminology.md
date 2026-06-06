# 脉冲方舟世界观 — 全局术语与文案统一 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全系统用户可见文案统一为「脉冲方舟」舰载终端风格，覆盖前端 WXML/JS 和后端 BizException message。

**Architecture:** 纯文案替换，不改逻辑、不改结构、不改 API。按文件逐个替换，每个任务独立可提交。

**Tech Stack:** 微信小程序原生（WXML/WXSS/JS）、Java Spring Boot

---

## 文件清单

### 后端
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java` — 空间相关 BizException
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoundRecordServiceImpl.java` — 本局录 BizException
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java` — 记分 BizException
- Modify: `backend/src/main/java/com/smartrecord/service/impl/MirrorProfileServiceImpl.java` — 镜像 BizException
- Modify: `backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java` — 身份 BizException
- Modify: `backend/src/main/java/com/smartrecord/service/impl/UserServiceImpl.java` — 用户 BizException
- Modify: `backend/src/main/java/com/smartrecord/service/impl/OverviewServiceImpl.java` — 总览 BizException
- Modify: `backend/src/main/java/com/smartrecord/controller/TtsController.java` — TTS BizException

### 前端
- Modify: `miniprogram/pages/room/room.wxml` — 空间页静态文案
- Modify: `miniprogram/pages/room/room.js` — 空间页 toast/modal
- Modify: `miniprogram/pages/fortune/fortune.wxml` — 策略页静态文案
- Modify: `miniprogram/pages/fortune/fortune.js` — 策略页 toast
- Modify: `miniprogram/pages/mirror/index.wxml` — 镜像页静态文案
- Modify: `miniprogram/pages/mirror/index.js` — 镜像页 toast
- Modify: `miniprogram/pages/profile/profile.wxml` — 身份页静态文案
- Modify: `miniprogram/pages/profile/profile.js` — 身份页 toast
- Modify: `miniprogram/pages/settle/settle.wxml` — 结算页静态文案
- Modify: `miniprogram/pages/settle/settle.js` — 结算页 toast
- Modify: `miniprogram/pages/login/login.wxml` — 登录页静态文案
- Modify: `miniprogram/pages/score-records/score-records.wxml` — 脉冲日志页静态文案
- Modify: `miniprogram/pages/score-records/score-records.js` — 脉冲日志页 toast
- Modify: `miniprogram/pages/voice-select/voice-select.js` — 音色选择页 toast

---

## Task 1: 后端 BizException 消息替换

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoundRecordServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/MirrorProfileServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/UserServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/service/impl/OverviewServiceImpl.java`
- Modify: `backend/src/main/java/com/smartrecord/controller/TtsController.java`

- [ ] **Step 1: 替换 RoomServiceImpl.java 中的 BizException 消息**

替换规则（全部用 Edit 工具的 replace_all 或精确替换）：

| 原文 | 替换为 |
|------|--------|
| `"你已有活跃房间，请先退出后再创建"` | `"你已有活跃空间，请先退出后再启动"` |
| `"请输入房间号"` | `"请输入识别码"` |
| `"房间不存在"` | `"空间不存在"` |
| `"房间已关闭"` | `"空间已关闭"` |
| `"房间人数已达上限，无法加入（最多16人）"` | `"空间舰员已满（上限16人）"` |
| `"用户不存在，请重新登录"` | `"身份未识别，请重新接入终端"` |
| `"仅房主可解散房间"` | `"仅主控可解散空间"` |
| `"房间已结算，不能修改记分设置"` | `"空间已封存，不能修改记录设置"` |

注意：`"你已接入当前空间，无需重复接入"` 和 `"身份重叠：场域内存在同名实体"` 已是舰载风格，不改。

- [ ] **Step 2: 替换 RoundRecordServiceImpl.java**

| 原文 | 替换为 |
|------|--------|
| `"房间不存在或已结算"` | `"空间不存在或已封存"` |
| `"房间不存在"` | `"空间不存在"` |

- [ ] **Step 3: 替换 ScoreServiceImpl.java**

| 原文 | 替换为 |
|------|--------|
| `"房间不存在或已结束"` | `"空间不存在或已封存"` |
| `"房间不存在"` | `"空间不存在"` |

- [ ] **Step 4: 替换其他 Service 和 Controller**

MirrorProfileServiceImpl.java:
- `"必须提交20题答案"` → `"协议校准需要完成20题"`
- `"非法MBTI类型编号: "` → `"协议类型无效: "`

IdentityLevelServiceImpl.java:
- `"用户不存在"` → `"身份未识别"`

UserServiceImpl.java:
- `"用户不存在"` → `"身份未识别"` (两处)

OverviewServiceImpl.java:
- `"房间不存在"` → `"空间不存在"`

TtsController.java:
- `"TTS 合成失败"` → `"语音合成失败"`

- [ ] **Step 5: 编译验证**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 6: 提交**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java \
  backend/src/main/java/com/smartrecord/service/impl/RoundRecordServiceImpl.java \
  backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java \
  backend/src/main/java/com/smartrecord/service/impl/MirrorProfileServiceImpl.java \
  backend/src/main/java/com/smartrecord/service/impl/IdentityLevelServiceImpl.java \
  backend/src/main/java/com/smartrecord/service/impl/UserServiceImpl.java \
  backend/src/main/java/com/smartrecord/service/impl/OverviewServiceImpl.java \
  backend/src/main/java/com/smartrecord/controller/TtsController.java
git commit -m "refactor: 后端 BizException 消息统一为舰载终端术语"
```

---

## Task 2: 空间页文案替换

**Files:**
- Modify: `miniprogram/pages/room/room.wxml`
- Modify: `miniprogram/pages/room/room.js`

- [ ] **Step 1: 替换 room.wxml 静态文案**

| 原文 | 替换为 |
|------|--------|
| `尚未登录` | `终端未接入` |
| `登录后即可启动或接入空间` | `接入终端后可启动或接入任务空间` |
| `去登录` | `接入终端` |

- [ ] **Step 2: 替换 room.js toast/modal 文案**

| 原文 | 替换为 |
|------|--------|
| `'创建失败'` | `'启动失败'` |
| `'加入失败'` | `'接入失败'` |
| `'记录成功'` | `'脉冲已记录'` |
| `'录入成功'` | `'录入已提交'` |
| `'确认退出？'` | `'确认退出当前空间？'` |
| `'正在归档...'` | `'正在封存航程...'` |
| `'暂无可封存数据'` | `'暂无可封存的航程数据'` |
| `'已退出'` | `'已断开'` |

注意：`'空间已启动'`、`'已接入空间'`、`'记录失败，请重试'` 已是舰载风格，不改。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.js
git commit -m "refactor: 空间页文案统一为舰载终端术语"
```

---

## Task 3: 策略页文案替换

**Files:**
- Modify: `miniprogram/pages/fortune/fortune.wxml`
- Modify: `miniprogram/pages/fortune/fortune.js`

- [ ] **Step 1: 替换 fortune.wxml 静态文案**

| 原文 | 替换为 |
|------|--------|
| `今日策略` (结果页标题) | `今日航行指令` |
| `核心已复位 · 点击卡牌启动新一轮策略推演` | `策略核心待机 · 点击启动` |
| `同步身份协议与历史样本，生成今日策略参考` | `同步身份协议与黑匣子样本，生成今日航行指令` |
| `下一次策略更新：` | `下次策略刷新：` |
| `核心洞察` | `当前状态` |
| `行动优势` | `执行节奏` |

注意：`STRATEGY CORE`、`CORE STATUS` 等英文 kicker 不改。

- [ ] **Step 2: 替换 fortune.js toast**

| 原文 | 替换为 |
|------|--------|
| `'策略生成失败'` | `'策略核心启动失败'` |
| `'生成失败'` | `'启动失败'` |

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/fortune/fortune.wxml miniprogram/pages/fortune/fortune.js
git commit -m "refactor: 策略页文案统一为舰载终端术语"
```

---

## Task 4: 镜像页文案替换

**Files:**
- Modify: `miniprogram/pages/mirror/index.wxml`
- Modify: `miniprogram/pages/mirror/index.js`

- [ ] **Step 1: 替换 index.wxml**

| 原文 | 替换为 |
|------|--------|
| `样本不足` | `黑匣子样本不足` |

- [ ] **Step 2: 替换 index.js toast**

| 原文 | 替换为 |
|------|--------|
| `'镜像加载失败'` | `'镜像投影加载失败'` |
| `'同步失败，请重试'` | `'协议同步失败，请重试'` |
| `'生成失败，请稍后重试'` | `'投影生成失败，请稍后重试'` |
| `'档案图已保存'` | `'镜像档案已保存'` |
| `'我的人格档案：'` | `'我的镜像档案：'` |
| `'请先生成档案卡'` | `'请先生成镜像档案'` |
| `'保存未完成，请稍后重试'` | `'保存未完成，请稍后重试'` (不改) |
| `'提交失败，请重试'` | `'提交失败，请重试'` (不改) |

注意：`'[SYNC] 协议参数已写入镜像'` 已是系统输出风格，不改。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/mirror/index.wxml miniprogram/pages/mirror/index.js
git commit -m "refactor: 镜像页文案统一为舰载终端术语"
```

---

## Task 5: 身份页文案替换

**Files:**
- Modify: `miniprogram/pages/profile/profile.wxml`
- Modify: `miniprogram/pages/profile/profile.js`

- [ ] **Step 1: 替换 profile.wxml 静态文案**

| 原文 | 替换为 |
|------|--------|
| `尚未登录` | `终端未接入` |
| `登录后即可管理个人信息` | `接入终端后可管理舰员档案` |
| `去登录` | `接入终端` |
| `成员代号` | `舰员代号` |
| `加入时间` | `接入时间` |
| `累计任务` | `航程样本` |
| `净数值` | `累计脉冲` |
| `正反馈率` | `稳定指数` |
| `任务数` | `样本数` |
| `累计数值` (stats-cell__sub) | `黑匣子样本` |
| `正反馈率` (stats-cell__sub) | `稳定指数` |
| `样本数` (stats-cell__sub) | `黑匣子样本` |

注意：`身份档案`、`数据矩阵`、`系统状态` 已是舰载风格，不改。

- [ ] **Step 2: 替换 profile.js toast**

| 原文 | 替换为 |
|------|--------|
| `'代号已更新'` | `'舰员代号已更新'` |
| `'脉冲终端 v1.0'` | `'脉冲方舟 v1.0'` |
| `title: '系统警告'` | `title: '终端警告'` |

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/profile/profile.wxml miniprogram/pages/profile/profile.js
git commit -m "refactor: 身份页文案统一为舰载终端术语"
```

---

## Task 6: 结算页文案替换

**Files:**
- Modify: `miniprogram/pages/settle/settle.wxml`
- Modify: `miniprogram/pages/settle/settle.js`

- [ ] **Step 1: 替换 settle.wxml 静态文案**

| 原文 | 替换为 |
|------|--------|
| `正在生成档案卡...` | `正在生成航程档案...` |
| `正在解析任务数据` | `正在解析航程数据` |
| `档案加载失败` | `航程档案加载失败` |
| `暂无任务数据` | `暂无航程数据` |
| `空间内未产生有效记录` | `空间内未产生有效脉冲` |
| `任务档案` | `航程档案` |
| `ROOM {{roomNo}}` | `SPACE {{roomNo}}` |

- [ ] **Step 2: 替换 settle.js**

| 原文 | 替换为 |
|------|--------|
| `'加载失败'` | `'航程数据加载失败'` |

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/settle/settle.wxml miniprogram/pages/settle/settle.js
git commit -m "refactor: 结算页文案统一为舰载终端术语"
```

---

## Task 7: 登录页 + 脉冲日志页 + 音色选择页文案替换

**Files:**
- Modify: `miniprogram/pages/login/login.wxml`
- Modify: `miniprogram/pages/score-records/score-records.wxml`
- Modify: `miniprogram/pages/score-records/score-records.js`
- Modify: `miniprogram/pages/voice-select/voice-select.js`

- [ ] **Step 1: 替换 login.wxml**

| 原文 | 替换为 |
|------|--------|
| `记录 · 分析 · 镜像 · 策略` | `脉冲 · 镜像 · 策略 · 身份` |

- [ ] **Step 2: 替换 score-records.wxml**

| 原文 | 替换为 |
|------|--------|
| `正在同步数值数据...` | `正在同步脉冲数据...` |
| `完成一次空间封存后写入日志` | `完成一次航程封存后写入黑匣子` |
| `近期净数值` | `近期脉冲` |
| `采样状态` | `样本状态` |
| `数值曲线未解锁` | `脉冲曲线未解锁` |
| `完成至少 {{curveUnlockCount}} 场封存后，系统将生成数值曲线。` | `完成至少 {{curveUnlockCount}} 次航程封存后，系统将展开脉冲曲线。` |

- [ ] **Step 3: 替换 score-records.js**

| 原文 | 替换为 |
|------|--------|
| `'任务档案加载失败'` | `'航程档案加载失败'` |

- [ ] **Step 4: 替换 voice-select.js**

| 原文 | 替换为 |
|------|--------|
| `'加载音色失败'` | `'通讯音色加载失败'` |
| `'已选择 '` | `'音色已切换：'` |

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/login/login.wxml \
  miniprogram/pages/score-records/score-records.wxml \
  miniprogram/pages/score-records/score-records.js \
  miniprogram/pages/voice-select/voice-select.js
git commit -m "refactor: 登录/日志/音色页文案统一为舰载终端术语"
```

---

## Task 8: 组件文案替换

**Files:**
- Modify: `miniprogram/components/transfer-modal/transfer-modal.wxml`
- Modify: `miniprogram/components/host-fill-modal/host-fill-modal.js`
- Modify: `miniprogram/components/battle-summary/battle-summary.wxml`
- Modify: `miniprogram/components/matrix-overview/matrix-overview.wxml`
- Modify: `miniprogram/components/flow-log-panel/flow-log-panel.wxml`

- [ ] **Step 1: 替换 transfer-modal.wxml**

| 原文 | 替换为 |
|------|--------|
| `确认记录` | `确认记录脉冲` |

- [ ] **Step 2: 替换 host-fill-modal.js**

| 原文 | 替换为 |
|------|--------|
| `'请填写所有成员数值'` | `'请填写所有舰员数值'` |

- [ ] **Step 3: 替换 battle-summary.wxml**

| 原文 | 替换为 |
|------|--------|
| `成员` (meta-label) | `舰员` |

- [ ] **Step 4: 替换 matrix-overview.wxml**

| 原文 | 替换为 |
|------|--------|
| `至少需要 2 名成员` | `至少需要 2 名舰员` |
| `往来成员` | `往来舰员` |
| `暂无记录` | `暂无脉冲记录` |

- [ ] **Step 5: 替换 flow-log-panel.wxml**

| 原文 | 替换为 |
|------|--------|
| `记录流已结束` | `脉冲流已结束` |

- [ ] **Step 6: 扫描其他组件**

```bash
grep -rn "房间\|成员\|结算\|分数\|记分\|加入\|创建" miniprogram/components/ --include="*.wxml" --include="*.js" | grep -v "node_modules\|\.wxss\|//\|/\*\|<!--.*-->" | grep -v "舰员\|空间\|封存\|脉冲\|识别码\|接入\|启动"
```

检查输出，确认无遗漏。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/components/
git commit -m "refactor: 组件文案统一为舰载终端术语"
```

---

## Task 9: 全局残留扫描

- [ ] **Step 1: 扫描前端残留旧术语**

```bash
grep -rn "房间\|成员\|结算\|生成策略\|重新生成\|退出登录\|登录" miniprogram/pages/ --include="*.wxml" --include="*.js" | grep -v "node_modules\|\.json\|//.*房间\|//.*成员" | grep -v "接入终端\|终端接入\|空间已启动\|已接入空间\|识别码\|空间不存在\|空间已封存\|空间舰员\|舰员代号\|航程\|黑匣子\|脉冲\|策略核心\|重新点火\|断开终端\|装备协议"
```

检查输出，确认无遗漏的用户可见旧术语。

- [ ] **Step 2: 扫描后端残留旧术语**

```bash
grep -rn "BizException.*房间\|BizException.*成员\|BizException.*结算\|BizException.*登录\|BizException.*用户不存在" backend/src/main/java --include="*.java" | grep -v "log\.\|//\|/\*\|\*"
```

确认输出为空。

- [ ] **Step 3: 编译验证**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 4: 最终提交（如有遗漏修复）**

```bash
git add -A
git commit -m "fix: 全局残留旧术语扫描清理"
```

---

## 验收标准

- [ ] 用户可见文案中不再出现"房间"、"成员"、"结算"、"生成策略"、"重新生成"、"退出登录"等旧术语（作为按钮/标题/toast）
- [ ] 后端 BizException 消息中不再出现"房间"
- [ ] 黑匣子概念在结算、身份、镜像、策略四处正确出现
- [ ] 底部 Tab 名不变（空间/策略/镜像/身份）
- [ ] API 路径、数据库字段、Redis key 不变
- [ ] 后端日志不变
- [ ] 后端编译通过
