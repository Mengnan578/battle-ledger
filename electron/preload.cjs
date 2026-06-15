const { contextBridge, ipcRenderer } = require('electron')

// Electron preloads run in a CommonJS context on Windows here, so keep this
// file in CJS to avoid "Cannot use import statement outside a module".
const DEBUG_SESSION_ID = 'floating-orb-input-bug'
const DEFAULT_DEBUG_URL = 'http://127.0.0.1:7777/event'

async function reportDebugEvent(payload) {
  try {
    await fetch(DEFAULT_DEBUG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: 'pre',
        ts: Date.now(),
        ...payload,
      }),
    })
  } catch {
    // Ignore debug reporting failures in production behavior.
  }
}

contextBridge.exposeInMainWorld('battleLedger', {
  getState: () => ipcRenderer.invoke('battle-ledger:get-state'),
  getMatchDetail: (matchId) => ipcRenderer.invoke('battle-ledger:get-match-detail', matchId),
  scanNow: () => ipcRenderer.invoke('battle-ledger:scan-now'),
  pickLogDirectory: () => ipcRenderer.invoke('battle-ledger:pick-log-directory'),
  updateSettings: (patch) => ipcRenderer.invoke('battle-ledger:update-settings', patch),
  searchPlayerName: (playerName) => ipcRenderer.invoke('battle-ledger:search-player-name', playerName),
  searchPlayerKeyword: (keyword) => ipcRenderer.invoke('battle-ledger:search-player-keyword', keyword),
  toggleDashboard: () => ipcRenderer.send('battle-ledger:toggle-dashboard'),
  toggleSearchPanel: () => ipcRenderer.send('battle-ledger:toggle-search-panel'),
  openMatchDetails: (matchId) => ipcRenderer.send('battle-ledger:open-match-details', { matchId }),
  startFloatingDrag: (offsetX, offsetY) =>
    ipcRenderer.send('battle-ledger:floating-drag-start', { offsetX, offsetY }),
  endFloatingDrag: () => ipcRenderer.send('battle-ledger:floating-drag-end'),
  startMainDrag: (offsetX, offsetY) => ipcRenderer.send('battle-ledger:main-drag-start', { offsetX, offsetY }),
  endMainDrag: () => ipcRenderer.send('battle-ledger:main-drag-end'),
  minimizeDashboard: () => ipcRenderer.send('battle-ledger:minimize-dashboard'),
  debugEvent: (payload) => reportDebugEvent(payload),
  onStateUpdated: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('battle-ledger:state-updated', listener)
    return () => ipcRenderer.removeListener('battle-ledger:state-updated', listener)
  },
  onSearchPanelVisibilityChanged: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('battle-ledger:search-panel-visibility', listener)
    return () => ipcRenderer.removeListener('battle-ledger:search-panel-visibility', listener)
  },
})
