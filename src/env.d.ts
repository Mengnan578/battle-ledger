export {};

declare global {
  interface Window {
    battleLedger?: {
      getState: () => Promise<unknown>;
      getMatchDetail: (matchId: string) => Promise<unknown>;
      scanNow: () => Promise<unknown>;
      pickLogDirectory: () => Promise<unknown>;
      updateSettings: (patch: Record<string, unknown>) => Promise<unknown>;
      searchPlayerName: (playerName: string) => Promise<unknown>;
      searchPlayerKeyword: (keyword: string) => Promise<unknown>;
      toggleDashboard: () => void;
      toggleSearchPanel: () => void;
      openMatchDetails: (matchId: string) => void;
      startFloatingDrag: (offsetX: number, offsetY: number) => void;
      endFloatingDrag: () => void;
      startMainDrag: (offsetX: number, offsetY: number) => void;
      endMainDrag: () => void;
      minimizeDashboard: () => void;
      debugEvent: (payload: Record<string, unknown>) => void;
      onStateUpdated: (callback: (payload: unknown) => void) => () => void;
      onSearchPanelVisibilityChanged: (callback: (payload: unknown) => void) => () => void;
    };
  }
}
