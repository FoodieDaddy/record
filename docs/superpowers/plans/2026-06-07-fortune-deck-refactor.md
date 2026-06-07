# Fortune Deck Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the fortune/strategy page into a spaceship deck-style navigation core with ship-themed terminology.

**Architecture:** Pure WXSS visual overhaul of 4 page modes (launch/generating/result/relaunchReady). JS state machine unchanged. Reuse terminal-popup for regeneration modal. All animations gated by animationEnabled.

**Tech Stack:** WXML + WXSS + WeChat Mini Program JS

---

### Task 1: Update fortune.json

**Files:**
- Modify: `miniprogram/pages/fortune/fortune.json`

- [ ] Register terminal-popup component and update nav title to "起飞甲板"

```json
{
  "navigationBarTitleText": "起飞甲板",
  "navigationBarBackgroundColor": "#0a0a0a",
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "terminal-popup": "/components/terminal-popup/terminal-popup"
  }
}
```

- [ ] Commit: `feat(fortune): register terminal-popup, update nav title`

---

### Task 2: Rewrite fortune.wxml

**Files:**
- Modify: `miniprogram/pages/fortune/fortune.wxml`

- [ ] Replace entire WXML with ship-deck themed version. Key changes:
  - launch: title "起飞甲板" / kicker "DECK ONLINE", core label "航行核心", button "点火航行核心", info "接入舰员协议与黑匣子样本 / 等待今日指令投影", status "甲板状态：待机"
  - generating: title "航行核心点火中" / kicker "NAV CORE ACTIVE", 3 log lines (舰员协议已同步 / 黑匣子样本已接入 / 安全边界生成中), remove progress steps
  - result: title "今日指令投影" / kicker "FLIGHT DIRECTIVE", sections renamed (状态读数/推进节奏/安全边界/舰载指令), buttons "重新点火"/"分享指令卡", countdown "下次校准"
  - Modal: replace custom modal with terminal-popup (kicker "重新点火", subtitle "REIGNITE NAV CORE", content about returning to deck, confirm "确认点火", cancel "保持当前")
  - Add deck perspective lines and HUD elements to launch/generating views

---

### Task 3: Rewrite fortune.wxss

**Files:**
- Modify: `miniprogram/pages/fortune/fortune.wxss`

- [ ] Add new visual elements:
  - `.deck-perspective` - bottom perspective lines with CSS transform
  - `.hud-marks` - left/right HUD tick marks via pseudo-elements
  - `.core-glow` - enhanced energy point with box-shadow
  - `.ignite-phase-*` - 4 ignition animation phases
  - `.scan-arc` - conic-gradient scan arc
  - `.deck-status` - bottom status line
- [ ] Update all reduce-motion rules to cover new animated elements
- [ ] Remove `.strategy-regen-*` styles (replaced by terminal-popup)
- [ ] Ensure all transitions use explicit properties, no `transition: all`

---

### Task 4: Update fortune.js

**Files:**
- Modify: `miniprogram/pages/fortune/fortune.js`

- [ ] Add `_igniteTimers[]` array and `_ignitePhase` data field
- [ ] Replace `_startGeneration` to run 4-phase ignition animation before generating:
  - Phase 1 (0-500ms): "航核点火"
  - Phase 2 (500-1000ms): "校准舰员状态"
  - Phase 3 (1000-1500ms): "接入黑匣子样本"
  - Phase 4 (1500-2000ms): "展开指令投影" → switch to generating
  - animationEnabled=false: skip directly to generating
- [ ] Update `CALC_LOG_LINES` to 3 entries: 舰员协议已同步 / 黑匣子样本已接入 / 安全边界生成中
- [ ] Update `stages` data to match new terminology (or remove if not needed in UI)
- [ ] Update `onConfirmRegenerate` to set pageMode='launch' (not relaunchReady)
- [ ] Update `_finishCalc` error toast text
- [ ] Update `onShareAppMessage` title
- [ ] Update poster canvas text labels
- [ ] Clear `_igniteTimers` in onHide/onUnload
- [ ] Replace custom modal handlers with terminal-popup events (onPopupConfirm/onPopupCancel)

---

### Task 5: Visual verification

- [ ] Open in WeChat DevTools, verify all 4 modes render correctly
- [ ] Toggle animationEnabled off, verify reduce-motion works
- [ ] Test ignition animation phases
- [ ] Test regeneration flow returns to launch
- [ ] Verify countdown shows "下次校准"
- [ ] Commit: `feat(fortune): complete deck-style refactor`
