import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const defaultLogDirectory =
  'd:\\WeGameApps\\rail_apps\\DeltaForce(2001918)\\DeltaForce\\Saved\\Logs';
const liveLogFileName = 'DeltaForce.log';
const devServerOrigin = 'http://127.0.0.1:5173';
const runtimeDataRoot = isDev
  ? path.join(process.cwd(), 'data', 'runtime')
  : path.join(app.getPath('appData'), 'BattleLedger');

fs.mkdirSync(runtimeDataRoot, { recursive: true });
fs.mkdirSync(path.join(runtimeDataRoot, 'session'), { recursive: true });
fs.mkdirSync(path.join(runtimeDataRoot, 'cache'), { recursive: true });

app.setPath('userData', runtimeDataRoot);
app.setPath('sessionData', path.join(runtimeDataRoot, 'session'));
app.commandLine.appendSwitch('disk-cache-dir', path.join(runtimeDataRoot, 'cache'));
app.commandLine.appendSwitch('media-cache-dir', path.join(runtimeDataRoot, 'cache'));

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
let floatingWindow = null;
let searchWindow = null;
let lastSearchWindowAutoHideAt = 0;
let searchWindowRevealTimer = null;
let scanTimer = null;
let isQuitting = false;
let directoryWatcher = null;
let fileWatchers = new Map();
let floatingDragState = null;
let floatingDragTimer = null;
let mainDragState = null;
let mainDragTimer = null;
let sqlModule = null;
let database = null;
let settingsCache = null;
let runtimeState = createRuntimeState();
const floatingPetSize = {
  width: 118,
  height: 138,
};

// #region debug-point floating-orb-input-bug-main
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
// #endregion debug-point floating-orb-input-bug-main

function createRuntimeState() {
  return {
    watching: false,
    lastScanAt: null,
    lastError: null,
    lastEvent: 'idle',
    currentDirectoryExists: false,
    indexedFileCount: 0,
    indexedMatchCount: 0,
    dataFilePath: getDatabasePath(),
    liveLogPath: path.join(defaultLogDirectory, liveLogFileName),
  };
}

function getDataRoot() {
  return isDev ? path.join(app.getAppPath(), 'data') : app.getPath('userData');
}

function getDatabasePath() {
  return path.join(getDataRoot(), 'battle-ledger.sqlite');
}

function getLegacyJsonPath() {
  return path.join(getDataRoot(), 'battle-ledger-db.json');
}

function getDefaultSettings() {
  return {
    appName: '战痕仪',
    logDirectory: defaultLogDirectory,
    autoWatch: true,
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isKnownValue(value) {
  return value !== undefined && value !== null && value !== '' && !String(value).startsWith('未识别');
}

function preferValue(left, right) {
  if (isKnownValue(left)) {
    return left;
  }
  return right;
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
}

function xorDecodeBuffer(buffer) {
  const hasBom = buffer.length >= 3 && buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191;
  const start = hasBom ? 3 : 0;
  const output = Buffer.alloc(Math.max(buffer.length - start, 0));
  for (let index = 0; index < output.length; index += 1) {
    output[index] = buffer[index + start] ^ 0x5c;
  }
  return output;
}

function scoreCandidate(text) {
  const sample = text.slice(0, 12000);
  const readable = sample.match(/[\x09\x0A\x0D\x20-\x7E\u4e00-\u9fa5]/gu)?.length ?? 0;
  const printableRatio = readable / Math.max(sample.length, 1);
  let score = printableRatio * 6;

  for (const keyword of [
    'Log',
    'PlayerName=',
    'AssemblyLabel:SetInfo',
    'StartMatchSucceed',
    'map_name:',
    'ds_room_id:',
    'team_id:',
    'CrashSight',
  ]) {
    if (sample.includes(keyword)) {
      score += 3;
    }
  }

  if (sample.includes('\uFFFD')) {
    score -= 4;
  }

  return score;
}

function decodeLogText(buffer) {
  const plainText = stripBom(buffer.toString('utf8'));
  const xorText = stripBom(xorDecodeBuffer(buffer).toString('utf8'));
  const plainScore = scoreCandidate(plainText);
  const xorScore = scoreCandidate(xorText);

  if (xorScore > plainScore) {
    return {
      text: xorText,
      sourceFormat: 'xor',
    };
  }

  return {
    text: plainText,
    sourceFormat: 'plain',
  };
}

function createMatchId(seed) {
  return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
}

function getMatchKey(match) {
  if (isKnownValue(match.dsRoomId)) {
    return `room:${match.dsRoomId}`;
  }
  return `fallback:${match.self?.uin ?? 'unknown'}:${match.startedAt}:${match.mapName}`;
}

function mergeMatch(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    matchKey: existing.matchKey ?? incoming.matchKey,
    dsRoomId: preferValue(existing.dsRoomId, incoming.dsRoomId),
    mapName: preferValue(existing.mapName, incoming.mapName),
    teamId: preferValue(existing.teamId, incoming.teamId),
    endReason: preferValue(existing.endReason, incoming.endReason),
    sourceFormat: preferValue(existing.sourceFormat, incoming.sourceFormat),
    startedAt: preferValue(existing.startedAt, incoming.startedAt),
    scannedAt: incoming.scannedAt,
    self: {
      name: preferValue(existing.self?.name, incoming.self?.name),
      uin: preferValue(existing.self?.uin, incoming.self?.uin),
    },
    teammateNames: unique([...(existing.teammateNames ?? []), ...(incoming.teammateNames ?? [])]),
    exits: unique([...(existing.exits ?? []), ...(incoming.exits ?? [])]),
    sourceFiles: unique([...(existing.sourceFiles ?? []), ...(incoming.sourceFiles ?? [])]),
  };
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function listCandidateLogFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.log$/i.test(name))
    .filter((name) => !/^cef/i.test(name))
    .map((name) => path.join(directoryPath, name))
    .sort((left, right) => (safeStat(right)?.mtimeMs ?? 0) - (safeStat(left)?.mtimeMs ?? 0));
}

function parsePlayerMap(text) {
  const playerRegex = /PlayerName=([^,\r\n]+),\s*Uin=(\d+)/g;
  const playersByUin = new Map();

  for (const entry of text.matchAll(playerRegex)) {
    const [, name, uin] = entry;
    if (!playersByUin.has(uin)) {
      playersByUin.set(uin, name.trim());
    }
  }

  return playersByUin;
}

function extractMatchesFromText(text, sourceFormat, filePath) {
  const matchStartRegex =
    /StartMatchSucceed::.*?map_name:([^,\s]+).*?ds_room_id:(\d+).*?time_stamp:(\d+).*?player_id:(\d+).*?team_id:(\d+)/g;
  const assemblyRegex = /AssemblyLabel:SetInfo,.*?playerNick,\s*([^,\r\n]+)/g;
  const exitRegex =
    /LogPlayerExit: Display:\s*(?:APlayerExitBase::OnSolTimelineEventIdChange ExitName=)?([^\r\n,]+?)(?:\s+PostLoad Active:|\s+APlayerExitBase::|\s+CutSceneMediaVideoName|$)/g;
  const starts = [...text.matchAll(matchStartRegex)].map((item) => ({
    index: item.index ?? 0,
    mapName: item[1] ?? '未识别地图',
    dsRoomId: item[2] ?? '未识别',
    timestamp: item[3] ?? '',
    playerId: item[4] ?? '未识别',
    teamId: item[5] ?? '未识别',
  }));
  const playersByUin = parsePlayerMap(text);

  return starts.map((start, index) => {
    const nextStart = starts[index + 1];
    const segmentStart = Math.max(0, start.index - 100000);
    const segmentEnd = nextStart?.index ?? text.length;
    const segment = text.slice(segmentStart, segmentEnd);
    const squadNames = unique([...segment.matchAll(assemblyRegex)].map((item) => item[1]?.trim()));
    const exits = unique(
      [...segment.matchAll(exitRegex)]
        .map((item) => item[1]?.trim())
        .filter((name) => name && !['PostLoad Active: 0', ''].includes(name)),
    ).slice(0, 12);
    const selfName =
      playersByUin.get(start.playerId) ?? squadNames.find((name) => name !== 'DefaultName') ?? '未识别';
    const teammateNames = squadNames.filter((name) => name && name !== selfName);
    const crashDetected =
      /Critical error|GameThread timed out waiting for RenderThread|CrashSight/i.test(segment);
    const quitDetected = /RequestExit|Quit|LeaveBattle|ReturnToLobby/i.test(segment);
    const startedAt = start.timestamp
      ? new Date(Number(start.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const endReason = crashDetected ? '异常结束' : quitDetected ? '中途退出' : '待补充';
    const matchSeed = `${start.dsRoomId}:${start.playerId}:${startedAt}:${start.mapName}`;

    return {
      id: createMatchId(matchSeed),
      matchKey: getMatchKey({
        dsRoomId: start.dsRoomId,
        self: { uin: start.playerId },
        startedAt,
        mapName: start.mapName,
      }),
      dsRoomId: start.dsRoomId,
      mapName: start.mapName,
      teamId: start.teamId,
      self: {
        name: selfName,
        uin: start.playerId,
      },
      teammateNames,
      exits,
      endReason,
      sourceFormat,
      startedAt,
      scannedAt: new Date().toISOString(),
      sourceFiles: [filePath],
    };
  });
}

function getSqlJsLocateFile() {
  return path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist');
}

function exec(sql, params = {}) {
  database.run(sql, params);
}

function queryAll(sql, params = {}) {
  const statement = database.prepare(sql, params);
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function queryOne(sql, params = {}) {
  return queryAll(sql, params)[0] ?? null;
}

function persistDatabase() {
  const targetPath = getDatabasePath();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(database.export()));
}

function initializeSchema() {
  database.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      file_path TEXT PRIMARY KEY,
      base_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      source_format TEXT NOT NULL,
      exists_flag INTEGER NOT NULL DEFAULT 1,
      last_indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      match_key TEXT NOT NULL UNIQUE,
      ds_room_id TEXT,
      map_name TEXT,
      team_id TEXT,
      self_name TEXT,
      self_uin TEXT,
      end_reason TEXT,
      source_format TEXT,
      started_at TEXT,
      scanned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS match_teammates (
      match_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      PRIMARY KEY (match_id, player_name)
    );

    CREATE TABLE IF NOT EXISTS match_exits (
      match_id TEXT NOT NULL,
      exit_name TEXT NOT NULL,
      PRIMARY KEY (match_id, exit_name)
    );

    CREATE TABLE IF NOT EXISTS match_sources (
      match_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      PRIMARY KEY (match_id, file_path)
    );

    CREATE INDEX IF NOT EXISTS idx_matches_started_at ON matches(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_self_name ON matches(self_name);
    CREATE INDEX IF NOT EXISTS idx_match_teammates_name ON match_teammates(player_name);
  `);
}

function getSetting(key, fallbackValue) {
  const row = queryOne('SELECT value FROM settings WHERE key = $key', { $key: key });
  if (!row) {
    return fallbackValue;
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return fallbackValue;
  }
}

function setSetting(key, value) {
  exec(
    `
      INSERT INTO settings (key, value)
      VALUES ($key, $value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    {
      $key: key,
      $value: JSON.stringify(value),
    },
  );
}

function readSettings() {
  return {
    appName: getSetting('appName', getDefaultSettings().appName),
    logDirectory: getSetting('logDirectory', getDefaultSettings().logDirectory),
    autoWatch: getSetting('autoWatch', getDefaultSettings().autoWatch),
  };
}

function writeSettings(nextSettings) {
  setSetting('appName', nextSettings.appName);
  setSetting('logDirectory', nextSettings.logDirectory);
  setSetting('autoWatch', nextSettings.autoWatch);
  settingsCache = nextSettings;
}

function sourceRowToView(row) {
  return {
    filePath: row.file_path,
    baseName: row.base_name,
    size: Number(row.size),
    mtimeMs: Number(row.mtime_ms),
    sourceFormat: row.source_format,
    exists: Boolean(row.exists_flag),
    lastIndexedAt: row.last_indexed_at,
    matchIds: queryAll('SELECT match_id FROM match_sources WHERE file_path = $path', { $path: row.file_path }).map(
      (item) => item.match_id,
    ),
  };
}

function matchRowToView(row) {
  return {
    id: row.id,
    matchKey: row.match_key,
    dsRoomId: row.ds_room_id ?? '未识别',
    mapName: row.map_name ?? '未识别地图',
    teamId: row.team_id ?? '未识别',
    self: {
      name: row.self_name ?? '未识别',
      uin: row.self_uin ?? '未识别',
    },
    teammateNames: queryAll('SELECT player_name FROM match_teammates WHERE match_id = $id ORDER BY player_name', {
      $id: row.id,
    }).map((item) => item.player_name),
    exits: queryAll('SELECT exit_name FROM match_exits WHERE match_id = $id ORDER BY exit_name', {
      $id: row.id,
    }).map((item) => item.exit_name),
    endReason: row.end_reason ?? '待补充',
    sourceFormat: row.source_format ?? 'unknown',
    startedAt: row.started_at ?? '',
    scannedAt: row.scanned_at ?? '',
    sourceFiles: queryAll('SELECT file_path FROM match_sources WHERE match_id = $id ORDER BY file_path', {
      $id: row.id,
    }).map((item) => item.file_path),
  };
}

function queryRecentMatches(limit = 50) {
  return queryAll(
    `
      SELECT *
      FROM matches
      ORDER BY started_at DESC, scanned_at DESC
      LIMIT $limit
    `,
    { $limit: limit },
  ).map(matchRowToView);
}

function querySources() {
  return queryAll(
    `
      SELECT *
      FROM sources
      ORDER BY mtime_ms DESC, base_name ASC
    `,
  ).map(sourceRowToView);
}

function queryMatchesByPlayerName(playerName) {
  if (!playerName.trim()) {
    return [];
  }

  return queryAll(
    `
      SELECT DISTINCT m.*
      FROM matches m
      LEFT JOIN match_teammates mt ON mt.match_id = m.id
      WHERE LOWER(COALESCE(m.self_name, '')) LIKE LOWER($pattern)
         OR LOWER(COALESCE(mt.player_name, '')) LIKE LOWER($pattern)
      ORDER BY m.started_at DESC, m.scanned_at DESC
      LIMIT 100
    `,
    { $pattern: `%${playerName.trim()}%` },
  ).map(matchRowToView);
}

function queryMatchesByKeyword(keyword) {
  if (!keyword.trim()) {
    return [];
  }

  return queryAll(
    `
      SELECT DISTINCT m.*
      FROM matches m
      LEFT JOIN match_teammates mt ON mt.match_id = m.id
      WHERE LOWER(COALESCE(m.self_name, '')) LIKE LOWER($pattern)
         OR LOWER(COALESCE(m.self_uin, '')) LIKE LOWER($pattern)
         OR LOWER(COALESCE(mt.player_name, '')) LIKE LOWER($pattern)
      ORDER BY m.started_at DESC, m.scanned_at DESC
      LIMIT 100
    `,
    { $pattern: `%${keyword.trim()}%` },
  ).map(matchRowToView);
}

function getMatchDetail(matchId) {
  const row = queryOne('SELECT * FROM matches WHERE id = $id', { $id: matchId });
  return row ? matchRowToView(row) : null;
}

function upsertSource(source) {
  exec(
    `
      INSERT INTO sources (
        file_path,
        base_name,
        size,
        mtime_ms,
        source_format,
        exists_flag,
        last_indexed_at
      ) VALUES (
        $filePath,
        $baseName,
        $size,
        $mtimeMs,
        $sourceFormat,
        $existsFlag,
        $lastIndexedAt
      )
      ON CONFLICT(file_path) DO UPDATE SET
        base_name = excluded.base_name,
        size = excluded.size,
        mtime_ms = excluded.mtime_ms,
        source_format = excluded.source_format,
        exists_flag = excluded.exists_flag,
        last_indexed_at = excluded.last_indexed_at
    `,
    {
      $filePath: source.filePath,
      $baseName: source.baseName,
      $size: source.size,
      $mtimeMs: source.mtimeMs,
      $sourceFormat: source.sourceFormat,
      $existsFlag: source.exists ? 1 : 0,
      $lastIndexedAt: source.lastIndexedAt,
    },
  );
}

function markMissingSources(activeFiles) {
  const rows = queryAll('SELECT file_path FROM sources');
  for (const row of rows) {
    if (!activeFiles.includes(row.file_path)) {
      exec('UPDATE sources SET exists_flag = 0 WHERE file_path = $filePath', {
        $filePath: row.file_path,
      });
    }
  }
}

function readExistingMatch(matchKey) {
  const row = queryOne('SELECT * FROM matches WHERE match_key = $matchKey', { $matchKey: matchKey });
  return row ? matchRowToView(row) : null;
}

function replaceMatchList(tableName, columnName, matchId, values) {
  exec(`DELETE FROM ${tableName} WHERE match_id = $matchId`, { $matchId: matchId });
  for (const value of values) {
    exec(`INSERT INTO ${tableName} (match_id, ${columnName}) VALUES ($matchId, $value)`, {
      $matchId: matchId,
      $value: value,
    });
  }
}

function replaceMatchSources(matchId, sourceFiles) {
  exec('DELETE FROM match_sources WHERE match_id = $matchId', { $matchId: matchId });
  for (const filePath of sourceFiles) {
    exec('INSERT INTO match_sources (match_id, file_path) VALUES ($matchId, $filePath)', {
      $matchId: matchId,
      $filePath: filePath,
    });
  }
}

function upsertParsedMatch(incomingMatch) {
  const existing = readExistingMatch(incomingMatch.matchKey);
  const merged = existing ? mergeMatch(existing, incomingMatch) : incomingMatch;
  const matchId = existing?.id ?? incomingMatch.id;

  exec(
    `
      INSERT INTO matches (
        id,
        match_key,
        ds_room_id,
        map_name,
        team_id,
        self_name,
        self_uin,
        end_reason,
        source_format,
        started_at,
        scanned_at
      ) VALUES (
        $id,
        $matchKey,
        $dsRoomId,
        $mapName,
        $teamId,
        $selfName,
        $selfUin,
        $endReason,
        $sourceFormat,
        $startedAt,
        $scannedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        match_key = excluded.match_key,
        ds_room_id = excluded.ds_room_id,
        map_name = excluded.map_name,
        team_id = excluded.team_id,
        self_name = excluded.self_name,
        self_uin = excluded.self_uin,
        end_reason = excluded.end_reason,
        source_format = excluded.source_format,
        started_at = excluded.started_at,
        scanned_at = excluded.scanned_at
    `,
    {
      $id: matchId,
      $matchKey: incomingMatch.matchKey,
      $dsRoomId: merged.dsRoomId,
      $mapName: merged.mapName,
      $teamId: merged.teamId,
      $selfName: merged.self.name,
      $selfUin: merged.self.uin,
      $endReason: merged.endReason,
      $sourceFormat: merged.sourceFormat,
      $startedAt: merged.startedAt,
      $scannedAt: merged.scannedAt,
    },
  );

  replaceMatchList('match_teammates', 'player_name', matchId, merged.teammateNames);
  replaceMatchList('match_exits', 'exit_name', matchId, merged.exits);
  replaceMatchSources(matchId, merged.sourceFiles);
}

function shouldIndexSource(filePath, stat) {
  const row = queryOne('SELECT size, mtime_ms, exists_flag FROM sources WHERE file_path = $filePath', {
    $filePath: filePath,
  });

  if (!row) {
    return true;
  }

  return Number(row.size) !== stat.size || Number(row.mtime_ms) !== stat.mtimeMs || Number(row.exists_flag) === 0;
}

function parseLogFile(filePath, stat) {
  const buffer = fs.readFileSync(filePath);
  const { text, sourceFormat } = decodeLogText(buffer);
  const matches = extractMatchesFromText(text, sourceFormat, filePath);

  return {
    matches,
    source: {
      filePath,
      baseName: path.basename(filePath),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      sourceFormat,
      exists: true,
      lastIndexedAt: new Date().toISOString(),
    },
  };
}

function createStatusSnapshot(settings) {
  return {
    ...runtimeState,
    dataFilePath: getDatabasePath(),
    liveLogPath: path.join(settings.logDirectory, liveLogFileName),
  };
}

function ensureFloatingWindowVisible() {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    void reportDebugEvent({ hypothesisId: 'A', msg: 'main.ensure-visible.skip-no-window', extra: {} });
    return;
  }

  void reportDebugEvent({
    hypothesisId: 'A',
    msg: 'main.ensure-visible.before-show',
    extra: {
      bounds: floatingWindow.getBounds(),
      visible: floatingWindow.isVisible(),
      minimized: floatingWindow.isMinimized(),
      focused: floatingWindow.isFocused(),
    },
  });
  floatingWindow.show();
  floatingWindow.moveTop();
  void reportDebugEvent({
    hypothesisId: 'A',
    msg: 'main.ensure-visible.after-show',
    extra: {
      bounds: floatingWindow.getBounds(),
      visible: floatingWindow.isVisible(),
      focused: floatingWindow.isFocused(),
    },
  });
}

function focusExistingWindows() {
  if (searchWindow && !searchWindow.isDestroyed() && searchWindow.isVisible()) {
    positionSearchWindow();
    searchWindow.focus();
    return;
  }

  if (floatingWindow && !floatingWindow.isDestroyed()) {
    ensureFloatingWindowVisible();
    floatingWindow.focus();
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function clampFloatingPosition(x, y) {
  const fallbackSize = floatingPetSize;
  const bounds = floatingWindow?.getBounds() ?? fallbackSize;
  const display = screen.getDisplayNearestPoint({ x, y });
  const { workArea } = display;
  const maxX = workArea.x + workArea.width - bounds.width;
  const maxY = workArea.y + workArea.height - bounds.height;

  return {
    x: Math.min(Math.max(x, workArea.x), maxX),
    y: Math.min(Math.max(y, workArea.y), maxY),
  };
}

function getSnapshot(searchQuery = '', searchResults = null) {
  const settings = settingsCache ?? readSettings();
  return {
    settings,
    status: createStatusSnapshot(settings),
    matches: queryRecentMatches(),
    sources: querySources(),
    search: {
      query: searchQuery,
      results: searchResults ?? [],
    },
  };
}

function getSearchWindowBounds() {
  return {
    width: 440,
    height: 340,
  };
}

function positionSearchWindow() {
  if (!searchWindow || searchWindow.isDestroyed()) {
    return;
  }

  const targetBounds = getSearchWindowBounds();
  const floatingBounds = floatingWindow?.getBounds() ?? null;
  const display = floatingBounds ? screen.getDisplayMatching(floatingBounds) : screen.getPrimaryDisplay();
  const { workArea } = display;
  const { width, height } = targetBounds;
  const gap = 12;
  let x = floatingBounds
    ? floatingBounds.x - width - gap
    : workArea.x + workArea.width - width - 24;

  if (floatingBounds && x < workArea.x + 12) {
    x = floatingBounds.x + floatingBounds.width + gap;
  }

  let y = floatingBounds
    ? floatingBounds.y + Math.round((floatingBounds.height - height) / 2)
    : workArea.y + Math.round((workArea.height - height) / 2);

  x = Math.min(Math.max(x, workArea.x + 12), workArea.x + workArea.width - width - 12);
  y = Math.min(Math.max(y, workArea.y + 12), workArea.y + workArea.height - height - 12);
  searchWindow.setBounds({ x, y, width, height });
}

function notifyStateUpdated() {
  const snapshot = getSnapshot();
  for (const win of [mainWindow, floatingWindow, searchWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('battle-ledger:state-updated', snapshot);
    }
  }
}

function notifySearchPanelVisibility(visible) {
  if (!searchWindow || searchWindow.isDestroyed()) {
    return;
  }

  searchWindow.webContents.send('battle-ledger:search-panel-visibility', { visible });
}

async function canUseDevServer() {
  if (!isDev) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);

  try {
    const response = await fetch(devServerOrigin, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

async function loadWindow(win, hash = '') {
  const hashSuffix = hash ? `#${hash}` : '';
  void reportDebugEvent({
    hypothesisId: 'A',
    msg: 'main.load-window.begin',
    extra: {
      hash,
      isDev,
    },
  });

  if (await canUseDevServer()) {
    void reportDebugEvent({
      hypothesisId: 'A',
      msg: 'main.load-window.dev-server',
      extra: {
        url: `${devServerOrigin}/${hashSuffix}`,
      },
    });
    await win.loadURL(`${devServerOrigin}/${hashSuffix}`);
    return;
  }

  void reportDebugEvent({
    hypothesisId: 'A',
    msg: 'main.load-window.dist-file',
    extra: {
      file: path.join(__dirname, '..', 'dist', 'index.html'),
      hash,
    },
  });
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    show: false,
    frame: false,
    title: '战痕仪',
    autoHideMenuBar: true,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('blur', () => {
    stopMainDrag();
  });
  mainWindow.on('hide', () => {
    stopMainDrag();
  });

  return loadWindow(mainWindow);
}

function createSearchWindow() {
  const bounds = getSearchWindowBounds();

  searchWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  searchWindow.on('close', (event) => {
    void reportDebugEvent({
      hypothesisId: 'B',
      msg: 'main.search.close',
      extra: {
        isQuitting,
        visible: searchWindow?.isVisible?.() ?? false,
      },
    });
    if (!isQuitting) {
      event.preventDefault();
      searchWindow.hide();
    }
  });
  searchWindow.on('blur', () => {
    void reportDebugEvent({
      hypothesisId: 'B',
      msg: 'main.search.blur',
      extra: {
        visible: searchWindow?.isVisible?.() ?? false,
        focused: searchWindow?.isFocused?.() ?? false,
      },
    });
    if (!searchWindow || searchWindow.isDestroyed()) {
      return;
    }
    if (searchWindowRevealTimer) {
      clearTimeout(searchWindowRevealTimer);
      searchWindowRevealTimer = null;
    }
    lastSearchWindowAutoHideAt = Date.now();
    searchWindow.setOpacity(1);
    searchWindow.hide();
  });
  searchWindow.on('ready-to-show', () => {
    void reportDebugEvent({
      hypothesisId: 'E',
      msg: 'main.search.ready-to-show',
      extra: searchWindow?.getBounds?.() ?? {},
    });
    positionSearchWindow();
  });
  searchWindow.on('show', () => {
    notifySearchPanelVisibility(true);
    void reportDebugEvent({
      hypothesisId: 'E',
      msg: 'main.search.show',
      extra: {
        bounds: searchWindow?.getBounds?.() ?? null,
      },
    });
  });
  searchWindow.on('hide', () => {
    if (searchWindowRevealTimer) {
      clearTimeout(searchWindowRevealTimer);
      searchWindowRevealTimer = null;
    }
    notifySearchPanelVisibility(false);
    void reportDebugEvent({
      hypothesisId: 'B',
      msg: 'main.search.hide',
      extra: {
        bounds: searchWindow?.getBounds?.() ?? null,
      },
    });
  });
  searchWindow.on('focus', () => {
    void reportDebugEvent({
      hypothesisId: 'E',
      msg: 'main.search.focus',
      extra: {
        bounds: searchWindow?.getBounds?.() ?? null,
      },
    });
  });

  return loadWindow(searchWindow, 'search');
}

function createFloatingWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const { width, height } = floatingPetSize;

  floatingWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 10,
    y: workArea.y + workArea.height - height - 88,
    show: false,
    frame: false,
    transparent: true,
    paintWhenInitiallyHidden: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void reportDebugEvent({
    hypothesisId: 'A',
    msg: 'main.create-floating-window',
    extra: {
        width,
        height,
      initialBounds: floatingWindow.getBounds(),
      workArea,
    },
  });

  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.once('ready-to-show', () => {
    void reportDebugEvent({ hypothesisId: 'A', msg: 'main.floating.ready-to-show', extra: {} });
    ensureFloatingWindowVisible();
    positionSearchWindow();
  });
  floatingWindow.on('blur', () => {
    void reportDebugEvent({ hypothesisId: 'A', msg: 'main.floating.blur', extra: {} });
    stopFloatingDrag();
  });
  floatingWindow.on('hide', () => {
    void reportDebugEvent({ hypothesisId: 'A', msg: 'main.floating.hide', extra: {} });
    stopFloatingDrag();
  });
  // #region debug-point floating-orb-input-bug-before-input
  {
    const lastSentAtByType = new Map();
    floatingWindow.webContents.on('before-input-event', (_event, input) => {
      const type = String(input?.type ?? 'unknown');
      if (!['mouseDown', 'mouseUp', 'mouseWheel', 'keyDown'].includes(type)) {
        return;
      }
      const now = Date.now();
      const last = lastSentAtByType.get(type) ?? 0;
      if (now - last < 80) {
        return;
      }
      lastSentAtByType.set(type, now);
      void reportDebugEvent({
        hypothesisId: 'A',
        msg: `main.before-input.${type}`,
        extra: {
          button: input?.button,
          deltaX: input?.deltaX,
          deltaY: input?.deltaY,
          x: input?.x,
          y: input?.y,
          modifiers: input?.modifiers,
        },
      });
    });
  }
  // #endregion debug-point floating-orb-input-bug-before-input
  // #region debug-point floating-orb-input-bug-renderer
  floatingWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    void reportDebugEvent({
      hypothesisId: 'B',
      msg: 'main.floating.console-message',
      extra: {
        level,
        message,
        line,
        sourceId,
      },
    });
  });
  floatingWindow.webContents.on('render-process-gone', (_event, details) => {
    void reportDebugEvent({
      hypothesisId: 'B',
      msg: 'main.floating.render-process-gone',
      extra: details,
    });
  });
  floatingWindow.webContents.on('preload-error', (_event, pathName, error) => {
    void reportDebugEvent({
      hypothesisId: 'B',
      msg: 'main.floating.preload-error',
      extra: {
        pathName,
        error: error?.message ?? String(error),
      },
    });
  });
  // #endregion debug-point floating-orb-input-bug-renderer
  floatingWindow.webContents.on('did-finish-load', () => {
    void reportDebugEvent({
      hypothesisId: 'A',
      msg: 'main.floating.did-finish-load',
      extra: {
        url: floatingWindow?.webContents.getURL(),
      },
    });
    void floatingWindow.webContents
      .executeJavaScript(
        `(() => ({
          href: window.location.href,
          hash: window.location.hash,
          hasBattleLedger: Boolean(window.battleLedger),
          bodyChildCount: document.body ? document.body.childElementCount : -1,
          rootHtmlLength: document.getElementById('root')?.innerHTML?.length ?? -1,
          readyState: document.readyState,
          title: document.title
        }))()`,
        true,
      )
      .then((result) => {
        void reportDebugEvent({
          hypothesisId: 'B',
          msg: 'main.floating.dom-snapshot',
          extra: result,
        });
      })
      .catch((error) => {
        void reportDebugEvent({
          hypothesisId: 'B',
          msg: 'main.floating.dom-snapshot-error',
          extra: {
            error: error?.message ?? String(error),
          },
        });
      });
    ensureFloatingWindowVisible();
  });
  floatingWindow.webContents.on('did-fail-load', () => {
    void reportDebugEvent({
      hypothesisId: 'A',
      msg: 'main.floating.did-fail-load',
      extra: {
        url: floatingWindow?.webContents.getURL(),
      },
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.center();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return loadWindow(floatingWindow, 'floating');
}

function toggleDashboard() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
}

function toggleSearchPanel() {
  void reportDebugEvent({
    hypothesisId: 'A',
    msg: 'main.toggle-search-panel.begin',
    extra: {
      hasWindow: Boolean(searchWindow && !searchWindow.isDestroyed()),
      visible: searchWindow?.isVisible?.() ?? false,
      focused: searchWindow?.isFocused?.() ?? false,
      lastAutoHideDelta: Date.now() - lastSearchWindowAutoHideAt,
    },
  });
  if (!searchWindow || searchWindow.isDestroyed()) {
    return;
  }

  if (searchWindow.isVisible()) {
    if (searchWindowRevealTimer) {
      clearTimeout(searchWindowRevealTimer);
      searchWindowRevealTimer = null;
    }
    void reportDebugEvent({ hypothesisId: 'A', msg: 'main.toggle-search-panel.hide-visible', extra: {} });
    searchWindow.hide();
    return;
  }

  if (Date.now() - lastSearchWindowAutoHideAt < 180) {
    void reportDebugEvent({ hypothesisId: 'A', msg: 'main.toggle-search-panel.skip-auto-hide-guard', extra: {} });
    lastSearchWindowAutoHideAt = 0;
    return;
  }

  positionSearchWindow();
  searchWindow.setOpacity(0);
  void reportDebugEvent({
    hypothesisId: 'C',
    msg: 'main.toggle-search-panel.show',
    extra: {
      bounds: searchWindow.getBounds(),
    },
  });
  searchWindow.show();
  searchWindow.focus();
  if (searchWindowRevealTimer) {
    clearTimeout(searchWindowRevealTimer);
  }
  searchWindowRevealTimer = setTimeout(() => {
    if (searchWindow && !searchWindow.isDestroyed() && searchWindow.isVisible()) {
      searchWindow.setOpacity(1);
      void reportDebugEvent({ hypothesisId: 'C', msg: 'main.toggle-search-panel.reveal', extra: {} });
    }
    searchWindowRevealTimer = null;
  }, 24);
}

async function openMatchDetails(matchId) {
  if (!matchId) {
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    await createMainWindow();
  }

  await loadWindow(mainWindow, `detail/${encodeURIComponent(matchId)}`);
  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
}

function stopMainDrag() {
  if (mainDragTimer) {
    clearInterval(mainDragTimer);
    mainDragTimer = null;
  }

  mainDragState = null;
}

function startMainDrag(payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const bounds = mainWindow.getBounds();
  const offsetX = Math.min(Math.max(Number(payload.offsetX ?? bounds.width / 2), 0), bounds.width);
  const offsetY = Math.min(Math.max(Number(payload.offsetY ?? 24), 0), bounds.height);

  mainDragState = {
    offsetX,
    offsetY,
  };

  if (mainDragTimer) {
    clearInterval(mainDragTimer);
  }

  mainDragTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainDragState) {
      stopMainDrag();
      return;
    }

    const cursorPoint = screen.getCursorScreenPoint();
    mainWindow.setPosition(
      Math.round(cursorPoint.x - mainDragState.offsetX),
      Math.round(cursorPoint.y - mainDragState.offsetY),
    );
  }, 16);
}

function stopFloatingDrag() {
  if (floatingDragTimer) {
    clearInterval(floatingDragTimer);
    floatingDragTimer = null;
  }

  floatingDragState = null;
  void reportDebugEvent({ hypothesisId: 'D', msg: 'main.drag.stop', extra: {} });
}

function startFloatingDrag(payload = {}) {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    void reportDebugEvent({ hypothesisId: 'D', msg: 'main.drag.start.no-window', extra: {} });
    return;
  }

  const bounds = floatingWindow.getBounds();
  const offsetX = Math.min(Math.max(Number(payload.offsetX ?? bounds.width / 2), 0), bounds.width);
  const offsetY = Math.min(Math.max(Number(payload.offsetY ?? bounds.height / 2), 0), bounds.height);

  floatingDragState = {
    offsetX,
    offsetY,
  };
  void reportDebugEvent({
    hypothesisId: 'D',
    msg: 'main.drag.start',
    extra: { offsetX, offsetY, bounds },
  });

  if (floatingDragTimer) {
    clearInterval(floatingDragTimer);
  }

  floatingDragTimer = setInterval(() => {
    if (!floatingWindow || floatingWindow.isDestroyed() || !floatingDragState) {
      stopFloatingDrag();
      return;
    }

    const cursorPoint = screen.getCursorScreenPoint();
    const nextPosition = clampFloatingPosition(
      Math.round(cursorPoint.x - floatingDragState.offsetX),
      Math.round(cursorPoint.y - floatingDragState.offsetY),
    );

    floatingWindow.setPosition(nextPosition.x, nextPosition.y);
    if (searchWindow && !searchWindow.isDestroyed() && searchWindow.isVisible()) {
      positionSearchWindow();
    }
  }, 16);
}

function debounceScan(reason = '文件变化', delay = 1000) {
  if (scanTimer) {
    clearTimeout(scanTimer);
  }

  scanTimer = setTimeout(() => {
    void scanDirectoryNow(reason);
  }, delay);
}

function closeAllWatchers() {
  stopFloatingDrag();

  if (directoryWatcher) {
    directoryWatcher.close();
    directoryWatcher = null;
  }

  for (const watcher of fileWatchers.values()) {
    watcher.close();
  }

  fileWatchers = new Map();
}

function syncFileWatchers(files) {
  const wanted = new Set(files);

  for (const [filePath, watcher] of fileWatchers.entries()) {
    if (!wanted.has(filePath)) {
      watcher.close();
      fileWatchers.delete(filePath);
    }
  }

  for (const filePath of wanted) {
    if (fileWatchers.has(filePath)) {
      continue;
    }

    try {
      const watcher = fs.watch(filePath, () => debounceScan(`文件更新: ${path.basename(filePath)}`, 600));
      fileWatchers.set(filePath, watcher);
    } catch {
      // Ignore files that cannot be watched temporarily.
    }
  }
}

function migrateLegacyJsonIfNeeded() {
  const legacyPath = getLegacyJsonPath();
  if (!fs.existsSync(legacyPath)) {
    return;
  }

  if (queryOne('SELECT id FROM matches LIMIT 1')) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    const settings = {
      ...getDefaultSettings(),
      ...parsed.settings,
      logDirectory:
        parsed?.settings?.logDirectory ??
        (parsed?.settings?.logPath ? path.dirname(parsed.settings.logPath) : getDefaultSettings().logDirectory),
    };

    writeSettings(settings);

    if (parsed?.sources && typeof parsed.sources === 'object') {
      for (const source of Object.values(parsed.sources)) {
        upsertSource({
          filePath: source.filePath,
          baseName: source.baseName ?? path.basename(source.filePath),
          size: Number(source.size ?? 0),
          mtimeMs: Number(source.mtimeMs ?? 0),
          sourceFormat: source.sourceFormat ?? 'unknown',
          exists: Boolean(source.exists),
          lastIndexedAt: source.lastIndexedAt ?? new Date().toISOString(),
        });
      }
    }

    if (Array.isArray(parsed?.matches)) {
      for (const match of parsed.matches) {
        upsertParsedMatch({
          ...match,
          matchKey: getMatchKey(match),
          sourceFiles: Array.isArray(match.sourceFiles) ? match.sourceFiles : [],
        });
      }
    }

    persistDatabase();
  } catch {
    // Ignore malformed legacy files and keep SQLite as source of truth.
  }
}

async function ensureDatabase() {
  if (database) {
    return;
  }

  sqlModule = await initSqlJs({
    locateFile: (file) => path.join(getSqlJsLocateFile(), file),
  });

  fs.mkdirSync(path.dirname(getDatabasePath()), { recursive: true });

  if (fs.existsSync(getDatabasePath())) {
    database = new sqlModule.Database(fs.readFileSync(getDatabasePath()));
  } else {
    database = new sqlModule.Database();
  }

  initializeSchema();

  if (!queryOne('SELECT key FROM settings WHERE key = $key', { $key: 'appName' })) {
    writeSettings(getDefaultSettings());
  } else {
    settingsCache = readSettings();
  }

  migrateLegacyJsonIfNeeded();
  settingsCache = readSettings();
  persistDatabase();
}

async function restartWatchers() {
  await ensureDatabase();
  closeAllWatchers();

  const settings = settingsCache ?? readSettings();
  const directoryPath = settings.logDirectory;
  const directoryExists = fs.existsSync(directoryPath);

  runtimeState.currentDirectoryExists = directoryExists;
  runtimeState.liveLogPath = path.join(directoryPath, liveLogFileName);

  if (!settings.autoWatch || !directoryExists) {
    runtimeState.watching = false;
    notifyStateUpdated();
    return;
  }

  try {
    directoryWatcher = fs.watch(directoryPath, () => debounceScan('目录变化', 800));
  } catch {
    directoryWatcher = null;
  }

  syncFileWatchers(listCandidateLogFiles(directoryPath));
  runtimeState.watching = true;
  notifyStateUpdated();
}

async function scanDirectoryNow(reason = '手动扫描') {
  await ensureDatabase();
  const settings = settingsCache ?? readSettings();
  const directoryPath = settings.logDirectory;

  if (!fs.existsSync(directoryPath)) {
    runtimeState = {
      ...runtimeState,
      watching: false,
      currentDirectoryExists: false,
      lastError: `日志目录不存在: ${directoryPath}`,
      lastEvent: reason,
      liveLogPath: path.join(directoryPath, liveLogFileName),
    };
    notifyStateUpdated();
    return getSnapshot();
  }

  const files = listCandidateLogFiles(directoryPath);

  markMissingSources(files);

  try {
    exec('BEGIN TRANSACTION');

    for (const filePath of files) {
      const stat = safeStat(filePath);
      if (!stat) {
        continue;
      }

      if (!shouldIndexSource(filePath, stat)) {
        exec('UPDATE sources SET exists_flag = 1 WHERE file_path = $filePath', {
          $filePath: filePath,
        });
        continue;
      }

      const parsed = parseLogFile(filePath, stat);
      upsertSource(parsed.source);

      for (const match of parsed.matches) {
        upsertParsedMatch(match);
      }
    }

    exec('COMMIT');
  } catch (error) {
    try {
      exec('ROLLBACK');
    } catch {
      // Ignore nested rollback failures.
    }

    runtimeState = {
      ...runtimeState,
      lastError: error instanceof Error ? error.message : '日志扫描失败',
      lastEvent: reason,
      liveLogPath: path.join(directoryPath, liveLogFileName),
    };
    notifyStateUpdated();
    return getSnapshot();
  }

  persistDatabase();
  syncFileWatchers(files);

  runtimeState = {
    ...runtimeState,
    watching: settings.autoWatch,
    currentDirectoryExists: true,
    indexedFileCount: files.length,
    indexedMatchCount: Number(queryOne('SELECT COUNT(*) AS count FROM matches')?.count ?? 0),
    lastScanAt: new Date().toISOString(),
    lastError: null,
    lastEvent: reason,
    liveLogPath: path.join(directoryPath, liveLogFileName),
    dataFilePath: getDatabasePath(),
  };

  notifyStateUpdated();
  return getSnapshot();
}

async function selectLogDirectory() {
  await ensureDatabase();
  const settings = settingsCache ?? readSettings();
  const result = await dialog.showOpenDialog({
    title: '选择三角洲日志目录',
    defaultPath: settings.logDirectory,
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return getSnapshot();
  }

  const nextSettings = {
    ...settings,
    logDirectory: result.filePaths[0],
  };

  writeSettings(nextSettings);
  persistDatabase();
  await restartWatchers();
  return scanDirectoryNow('切换目录');
}

async function updateSettings(patch) {
  await ensureDatabase();
  const settings = settingsCache ?? readSettings();
  const nextSettings = {
    ...settings,
    ...patch,
  };

  writeSettings(nextSettings);
  persistDatabase();
  await restartWatchers();
  return getSnapshot();
}

async function searchMatchesByPlayerName(playerName) {
  await ensureDatabase();
  return {
    ...getSnapshot(playerName, queryMatchesByPlayerName(playerName)),
  };
}

async function searchMatchesByKeyword(keyword) {
  await ensureDatabase();
  return {
    ...getSnapshot(keyword, queryMatchesByKeyword(keyword)),
  };
}

ipcMain.handle('battle-ledger:get-state', async () => {
  await ensureDatabase();
  return getSnapshot();
});
ipcMain.handle('battle-ledger:get-match-detail', async (_event, matchId) => {
  await ensureDatabase();
  return getMatchDetail(matchId);
});
ipcMain.handle('battle-ledger:scan-now', () => scanDirectoryNow('手动扫描'));
ipcMain.handle('battle-ledger:pick-log-directory', () => selectLogDirectory());
ipcMain.handle('battle-ledger:update-settings', (_event, patch) => updateSettings(patch));
ipcMain.handle('battle-ledger:search-player-name', (_event, playerName) => searchMatchesByPlayerName(playerName));
ipcMain.handle('battle-ledger:search-player-keyword', (_event, keyword) => searchMatchesByKeyword(keyword));
ipcMain.on('battle-ledger:toggle-dashboard', () => {
  void reportDebugEvent({ hypothesisId: 'C', msg: 'ipc.toggle-dashboard', extra: {} });
  toggleDashboard();
});
ipcMain.on('battle-ledger:toggle-search-panel', () => {
  void reportDebugEvent({ hypothesisId: 'C', msg: 'ipc.toggle-search-panel', extra: {} });
  toggleSearchPanel();
});
ipcMain.on('battle-ledger:open-match-details', (_event, payload) => {
  void reportDebugEvent({ hypothesisId: 'C', msg: 'ipc.open-match-details', extra: payload ?? {} });
  void openMatchDetails(payload?.matchId);
});
ipcMain.on('battle-ledger:floating-drag-start', (_event, payload) => {
  void reportDebugEvent({ hypothesisId: 'D', msg: 'ipc.drag-start', extra: payload ?? {} });
  startFloatingDrag(payload);
});
ipcMain.on('battle-ledger:floating-drag-end', () => {
  void reportDebugEvent({ hypothesisId: 'D', msg: 'ipc.drag-end', extra: {} });
  stopFloatingDrag();
});
ipcMain.on('battle-ledger:main-drag-start', (_event, payload) => {
  startMainDrag(payload);
});
ipcMain.on('battle-ledger:main-drag-end', () => {
  stopMainDrag();
});
ipcMain.on('battle-ledger:minimize-dashboard', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

app.whenReady().then(async () => {
  await ensureDatabase();
  settingsCache = readSettings();
  await createMainWindow();
  await createSearchWindow();
  await createFloatingWindow();

  ensureFloatingWindowVisible();
  setTimeout(() => {
    if (floatingWindow && !floatingWindow.isDestroyed() && !floatingWindow.isVisible()) {
      ensureFloatingWindowVisible();
    }

    if (
      (!floatingWindow || floatingWindow.isDestroyed() || !floatingWindow.isVisible()) &&
      mainWindow &&
      !mainWindow.isDestroyed() &&
      !mainWindow.isVisible()
    ) {
      mainWindow.center();
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1200);
  await restartWatchers();
  await scanDirectoryNow('应用启动');

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      void createMainWindow();
    }
    if (!searchWindow || searchWindow.isDestroyed()) {
      void createSearchWindow();
    }
    if (!floatingWindow || floatingWindow.isDestroyed()) {
      void createFloatingWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopMainDrag();
  closeAllWatchers();
});

app.on('second-instance', () => {
  focusExistingWindows();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
