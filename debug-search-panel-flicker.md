# Debug Session: search-panel-flicker
- **Status**: [OPEN]
- **Issue**: 点击桌宠后，搜索框依然会闪烁后再展示。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-search-panel-flicker.ndjson

## Reproduction Steps
1. 启动 Electron 桌面端。
2. 点击桌宠一次，观察搜索框展示过程。
3. 记录是否出现闪一下、先开后关、或位置跳动。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 桌宠点击后仍有两条以上切换链路同时触发，导致一次点击执行多次 `toggleSearchPanel()` | High | Low | Pending |
| B | 搜索窗 `blur` 在显示后立即触发，导致 `hide()` 后又被重新打开 | High | Low | Pending |
| C | 搜索窗 `show/focus/position` 顺序导致窗口先显示在一个状态，再被二次定位或二次聚焦，引发视觉闪烁 | Med | Low | Pending |
| D | 渲染层点击事件与主进程窗口事件存在竞态，导致 `mouseup` 后又收到额外关闭事件 | Med | Med | Pending |
| E | 搜索窗本身首次显示时存在 `ready-to-show` / `show` / `focus` 生命周期抖动 | Low | Low | Pending |

## Log Evidence
- Instrumentation added at:
  - `src/features/floating/FloatingPet.tsx`
  - `electron/main.mjs`
- Local collector running at `http://127.0.0.1:7777/event`
- Representative pre-fix sequence:
  - `floating.window-mouseup` -> `ipc.toggle-search-panel` -> `main.toggle-search-panel.show`
  - `main.search.show` -> `main.search.focus`
  - No second `main.toggle-search-panel.show` and no immediate `main.search.hide`
- Key timestamps from one reproduction:
  - `1781158454364`: `main.toggle-search-panel.begin`
  - `1781158454377`: `main.search.show`
  - `1781158454386`: `main.search.focus`
  - This indicates single-toggle behavior with visible repaint during show/focus handoff.

## Verification Conclusion
- Hypothesis A: Rejected for the captured click. Logs show only one `ipc.toggle-search-panel` and one `main.toggle-search-panel.show`.
- Hypothesis B: Rejected for the captured click. `main.search.blur/hide` occurs on later user interaction, not immediately after opening.
- Hypothesis C: Currently confirmed as the most likely root cause. Search window appears to repaint during `show -> focus` transition.
- Hypothesis D: Not primary cause for the captured click. There are extra `drag-end` events, but they do not lead to a second toggle.
- Hypothesis E: Supported. Search window lifecycle shows `show` then `focus` as separate visible phases.

## Bug Record
- **Symptom**: Clicking the floating pet causes the search panel to visibly flicker before settling.
- **Impact**: Users perceive unstable opening behavior and may click repeatedly, causing repeated open/guard cycles.
- **Observed Scope**: Floating pet to search panel transition only; not reproduced as a duplicate toggle in logs.
- **Current Fix Attempt**:
  - Search window now opens with opacity `0`
  - After `show/focus` settles, a short reveal timer sets opacity back to `1`
  - `blur/hide` clears the reveal timer to prevent stale delayed reveal
- **Files touched in fix**:
  - `electron/main.mjs`
