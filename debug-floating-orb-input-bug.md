# Debug Session: floating-orb-input-bug
- **Status**: [OPEN]
- **Issue**: 悬浮球在部分情况下无法拖动/无法响应左右键点击
- **Debug Server**: http://127.0.0.1:<port>/event
- **Log File**: .dbg/trae-debug-log-floating-orb-input-bug.ndjson

## Reproduction Steps
1. `cd D:\battle-ledger`
2. `npm run start`
3. 尝试左键点击悬浮球（期望打开主面板）
4. 尝试左键按住拖动悬浮球（期望移动位置）
5. 尝试右键悬浮球（期望也能打开主面板或至少有响应）

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 悬浮窗里鼠标事件未到达渲染层（透明窗口/点击穿透相关） | High | Med | Pending |
| B | 事件到达渲染层，但被 `preventDefault/stopPropagation` 或状态机卡住导致不触发动作 | Med | Low | Pending |
| C | IPC 发出但主进程未收到/窗口未 show（toggleDashboard 链路断） | Med | Med | Pending |
| D | 拖拽轮询定时器未启动或未停止（状态残留导致后续拖拽失效） | Med | Med | Pending |
| E | offsetX/offsetY 取值异常导致窗口位置计算错误，看起来“无法拖动” | Low | Low | Pending |

## Log Evidence
- `npm run start` 构建成功，随后出现 Chromium 缓存错误：`Unable to move the cache` / `Gpu Cache Creation failed`
- Electron 进程实际仍在运行：存在多个 `electron` 进程，且有 `battle-ledger` 主窗口标题
- 主进程证据表明悬浮窗已创建并调用 `show()`：
  - `main.create-floating-window`
  - `main.floating.did-finish-load`
  - `main.ensure-visible.after-show` 且 `visible=true`
- 现阶段未看到渲染层 `floating.mounted` 证据，说明问题更像“窗口显示/绘制可见性”而不是“主进程未启动”

## Hypothesis Status
- A: **Partially confirmed**。悬浮页面 URL 已加载完成，但渲染层挂载证据缺失，需继续验证页面是否实际绘制
- B: **Partially confirmed**。当前仍无渲染层鼠标事件证据，更像渲染层未正常挂载，而不是单纯事件被拦截
- C: **Rejected**。主进程确实收到并执行了窗口显示链路
- D: **Pending**。当前还未进入用户拖拽阶段
- E: **Possible**。窗口可能显示但不可见、透明、被系统层影响，需继续验证

## Verification Conclusion
- **Pre-fix**: `npm run start` 后出现 Chromium 缓存目录权限错误：
  - `Unable to move the cache`
  - `Unable to create cache`
  - `Gpu Cache Creation failed: -2`
- **Fix**: 将 Electron 的 `userData/sessionData/cache` 显式切到应用可控目录 `data/runtime`
- **Post-fix**: 本地再次执行 `npm run start`，构建完成后未再看到上述缓存错误输出
