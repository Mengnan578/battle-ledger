export type MatchRecord = {
  id: string
  dsRoomId: string
  mapName: string
  teamId: string
  self: {
    name: string
    uin: string
  }
  teammateNames: string[]
  exits: string[]
  endReason: string
  sourceFormat: string
  startedAt: string
  scannedAt: string
  sourceFiles: string[]
}

export type SourceRecord = {
  filePath: string
  baseName: string
  size: number
  mtimeMs: number
  sourceFormat: string
  exists: boolean
  lastIndexedAt: string
  matchIds: string[]
}

export type AppState = {
  settings: {
    appName: string
    logDirectory: string
    autoWatch: boolean
  }
  status: {
    watching: boolean
    lastScanAt: string | null
    lastError: string | null
    lastEvent: string
    currentDirectoryExists: boolean
    indexedFileCount: number
    indexedMatchCount: number
    dataFilePath: string
    liveLogPath: string
  }
  matches: MatchRecord[]
  sources: SourceRecord[]
  search: {
    query: string
    results: MatchRecord[]
  }
}

export const fallbackState: AppState = {
  settings: {
    appName: '战痕仪',
    logDirectory: 'd:\\WeGameApps\\rail_apps\\DeltaForce(2001918)\\DeltaForce\\Saved\\Logs',
    autoWatch: true,
  },
  status: {
    watching: false,
    lastScanAt: null,
    lastError: '当前是浏览器预览模式，请从 Electron 启动查看完整能力。',
    lastEvent: 'idle',
    currentDirectoryExists: false,
    indexedFileCount: 0,
    indexedMatchCount: 0,
    dataFilePath: 'd:\\battle-ledger\\data\\battle-ledger-db.json',
    liveLogPath: 'd:\\WeGameApps\\rail_apps\\DeltaForce(2001918)\\DeltaForce\\Saved\\Logs\\DeltaForce.log',
  },
  matches: [],
  sources: [],
  search: {
    query: '',
    results: [],
  },
}
