import { fallbackState, type AppState, type MatchRecord } from '../types/battleLedger'

function getApi() {
  return window.battleLedger
}

export async function fetchAppState() {
  const api = getApi()
  if (!api?.getState) {
    return fallbackState
  }

  return (await api.getState()) as AppState
}

export function subscribeAppState(callback: (payload: AppState) => void) {
  const api = getApi()
  if (!api?.onStateUpdated) {
    return () => {}
  }

  return api.onStateUpdated((payload) => {
    callback(payload as AppState)
  })
}

export function subscribeSearchPanelVisibility(callback: (visible: boolean) => void) {
  const api = getApi()
  if (!api?.onSearchPanelVisibilityChanged) {
    return () => {}
  }

  return api.onSearchPanelVisibilityChanged((payload) => {
    callback(Boolean((payload as { visible?: boolean })?.visible))
  })
}

export async function fetchMatchDetail(matchId: string) {
  const api = getApi()
  if (!api?.getMatchDetail) {
    return null
  }

  return (await api.getMatchDetail(matchId)) as MatchRecord | null
}

export function toggleSearchPanel() {
  getApi()?.toggleSearchPanel?.()
}

export function toggleDashboard() {
  getApi()?.toggleDashboard?.()
}

export function openMatchDetails(matchId: string) {
  getApi()?.openMatchDetails?.(matchId)
}

export function startFloatingDrag(offsetX: number, offsetY: number) {
  getApi()?.startFloatingDrag?.(offsetX, offsetY)
}

export function endFloatingDrag() {
  getApi()?.endFloatingDrag?.()
}

export function startMainDrag(offsetX: number, offsetY: number) {
  getApi()?.startMainDrag?.(offsetX, offsetY)
}

export function endMainDrag() {
  getApi()?.endMainDrag?.()
}

export function minimizeDashboard() {
  getApi()?.minimizeDashboard?.()
}

export function debugEvent(payload: Record<string, unknown>) {
  getApi()?.debugEvent?.(payload)
}
