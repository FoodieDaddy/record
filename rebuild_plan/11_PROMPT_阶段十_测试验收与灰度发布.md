# Phase 10 Prompt：测试验收与灰度发布

## 角色

你是 QA + 发布工程师。请为本次微信小程序前后端重构建立完整验收、性能回归、安全测试和灰度发布流程。

## 阶段目标

1. 建立固定真机回归清单。
2. 建立性能指标基线和阶段性目标。
3. 补齐后端权限与接口测试。
4. 建立灰度开关和回滚策略。
5. 输出上线前检查清单。

## 真机回归链路

每次发版必须执行：

1. 登录。
2. 进入驾驶舱。
3. 创建编队。
4. 进入 active room。
5. 连续记录 5 次脉冲。
6. 打开数值总览。
7. 关闭数值总览。
8. 打开航迹日志。
9. 返回驾驶舱。
10. 切换到指令页。
11. 触发一次指令生成。
12. 切换到镜像页。
13. 触发一次镜像卡生成或查看。
14. 切换到身份页。
15. 修改呼号弹窗打开/输入/关闭。
16. 试听音色。
17. 后台 30 秒再回前台。
18. 弱网断开再恢复。
19. 封存/结算流程。
20. 退出房间再进入。

## 性能目标

| 指标 | Phase 1 目标 | Phase 2~3 目标 | 最终目标 |
|---|---:|---:|---:|
| room 页单次脉冲 setData 次数 | 降低 30% | 降低 60% | 降低 70%+ |
| 连续 5 次脉冲体感 | 无明显阻塞 | 基本顺滑 | 顺滑稳定 |
| 数值总览打开 | 不阻塞点击 | 动画先完成 | 200 条记录不卡顿 |
| 冷启动首屏 | 可接受 | 明显改善 | 主包瘦身后稳定 |
| WS 重连 | 不死连 | 自动恢复 | 恢复后快照一致 |
| 非成员读房间数据 | 禁止 | 禁止 | 禁止 |

## 前端测试清单

### room 页

- [ ] 创建房间成功。
- [ ] 加入房间成功。
- [ ] 成员在线状态正确。
- [ ] 脉冲记录成功。
- [ ] 飞线动画不阻塞输入。
- [ ] 分数变化正确。
- [ ] 连续点击不会重复提交。
- [ ] 数值总览打开顺滑。
- [ ] 弹层关闭后无遮罩残留。
- [ ] 页面卸载后无异步 setData 报错。

### 指令页

- [ ] 进入页面不立即执行重 Canvas。
- [ ] 生成 loading 不超过预期。
- [ ] 失败态可重试。
- [ ] 海报导出只在用户点击后执行。

### 镜像页

- [ ] 镜像协议页动画不拖沓。
- [ ] 画像数据加载失败有兜底。
- [ ] 镜像卡导出不阻塞页面切换。

### 身份页

- [ ] 呼号弹窗真机键盘弹起不遮挡。
- [ ] 音色试听不会多音频叠播。
- [ ] 反复进入身份页音频仍可播放。
- [ ] 头像加载失败有默认图。

## 后端安全测试

### 房间读权限

准备两个用户：A 是房间成员，B 不是。

B 请求以下接口应失败：

```text
GET /room/{roomId}
GET /score/room/{roomId}/ranking
GET /score/room/{roomId}/chart
GET /score/room/{roomId}/network
GET /score/room/{roomId}/insight
GET /score/transfer/room/{roomId}
```

### WebSocket 权限

B 使用合法 token 连接 A 房间 roomId：

预期：连接被拒绝或立即关闭。

### 预签名上传

- 未登录请求失败。
- 非白名单 MIME 失败。
- 超大 size 失败。
- 非法 objectKey 前缀失败。

## 自动化建议

后端至少补：

- `RoomAccessGuardTest`
- `ScoreControllerAuthTest`
- `StoragePresignAuthTest`
- `ScoreWebSocketAuthTest`
- `TransferConcurrencyTest`

前端至少补纯函数单测：

- `deriveMemberGrid`
- `buildRelationMap`
- `patchRankingByTransfer`
- `normalizeWsMessage`

## 灰度开关

新增配置：

```js
featureFlags: {
  motionV2: true,
  roomStoreV2: true,
  matrixLazyChart: true,
  requestDedupe: true,
  lowMotionMode: false
}
```

出现问题时可快速关闭：

- `motionV2`
- `roomStoreV2`
- `matrixLazyChart`
- `requestDedupe`

## 发布前检查

```md
# 发布检查

- [ ] 代码已合并最新主分支
- [ ] 无真实密钥
- [ ] 后端测试通过
- [ ] 前端构建通过
- [ ] 真机回归通过
- [ ] 弱网测试通过
- [ ] WebSocket 重连通过
- [ ] 非成员权限测试通过
- [ ] 预签名上传鉴权通过
- [ ] feature flag 可回滚
- [ ] 版本号和 changelog 已更新
```

## 输出格式

```md
# Phase 10 测试验收与灰度发布报告

## 真机回归结果

## 性能对比

## 安全测试结果

## 自动化测试结果

## 灰度开关状态

## 发布风险

## 回滚方案
```

## 验收标准

- 所有核心链路通过真机测试。
- 非成员权限测试全部失败符合预期。
- 弱网和前后台恢复可用。
- 关键 feature flag 可关闭。
- 发布前无密钥泄露。
