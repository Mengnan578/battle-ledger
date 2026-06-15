import { contextBridge, ipcRenderer } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// #region debug-point floating-orb-input-bug-preload
const DEBUG_SESSION_ID = 'floating-orb-input-bug';
const DEFAULT_DEBUG_URL = 'http://127.0.0.1:7777/event';
let debugServerUrlCache = null;

function readDebugServerUrl() {
  if (debugServerUrlCache) {
    return debugServerUrlCache;
  }

  try {
    const envPath = path.join(process.cwd(), '.dbg', `${DEBUG_SESSION_ID}.env`);
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^DEBUG_SERVER_URL=(.+)$/m);
    debugServerUrlCache = match?.[1]?.trim() || DEFAULT_DEBUG_URL;
    return debugServerUrlCache;
  } catch {
    debugServerUrlCache = DEFAULT_DEBUG_URL;
    return debugServerUrlCache;
  }
}

async function reportDebugEvent(payload) {
  const apiUrl = readDebugServerUrl();
  try {
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: 'pre',
        ts: Date.now(),
        ...payload,
      }),
    });
  } catch {
    // ignore
  }
}
// #endregion debug-point floating-orb-input-bug-preload

contextBridge.exposeInMainWorld('battleLedger', {
  getState: () => ipcRenderer.invoke('battle-ledger:get-state'),
  scanNow: () => ipcRenderer.invoke('battle-ledger:scan-now'),
  pickLogDirectory: () => ipcRenderer.invoke('battle-ledger:pick-log-directory'),
  updateSettings: (patch) => ipcRenderer.invoke('battle-ledger:update-settings', patch),
  searchPlayerName: (playerName) => ipcRenderer.invoke('battle-ledger:search-player-name', playerName),
  toggleDashboard: () => ipcRenderer.send('battle-ledger:toggle-dashboard'),
  startFloatingDrag: (offsetX, offsetY) =>
    ipcRenderer.send('battle-ledger:floating-drag-start', { offsetX, offsetY }),
  endFloatingDrag: () => ipcRenderer.send('battle-ledger:floating-drag-end'),
  minimizeDashboard: () => ipcRenderer.send('battle-ledger:minimize-dashboard'),
  debugEvent: (payload) => reportDebugEvent(payload),
  onStateUpdated: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('battle-ledger:state-updated', listener);
    return () => ipcRenderer.removeListener('battle-ledger:state-updated', listener);
  },
});
