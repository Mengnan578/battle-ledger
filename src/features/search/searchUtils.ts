import Fuse from 'fuse.js'

import type { MatchRecord } from '../../types/battleLedger'

export type SearchRelationType = 'teammate' | 'killed_me' | 'killed_by_me'

type SearchCandidate = {
  playerKey: string
  playerName: string
  matchId: string
  mapName: string
  teamId: string
  endReason: string
  startedAt: string
  sourceFiles: string[]
}

export type SearchResultCard = {
  playerKey: string
  playerName: string
  playerUin: string | null
  primaryRelation: SearchRelationType
  relationCounts: Record<SearchRelationType, number>
  summaryText: string
  detailText: string
  evidence: string[]
  latestMatchId: string
  latestEventAt: string
  latestMapName: string
  latestEndReason: string
}

type SearchSummary = {
  keyword: string
  totalCards: number
  teammateCards: number
  killedMeCards: number
  killedByMeCards: number
  capabilityNote: string
}

export type SearchView = {
  query: string
  summary: SearchSummary | null
  cards: SearchResultCard[]
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return '暂未扫描'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  })
}

function includesKeyword(source: string, keyword: string) {
  return source.toLowerCase().includes(keyword.trim().toLowerCase())
}

export function buildSearchHitText(match: MatchRecord, keyword: string) {
  const normalizedKeyword = keyword.trim()
  if (!normalizedKeyword) {
    return '输入名字或 ID 开始查询'
  }

  const teammateHits = match.teammateNames.filter((name) => includesKeyword(name, normalizedKeyword))
  if (teammateHits.length > 0) {
    return `同队命中: ${teammateHits.join('、')}`
  }

  if (includesKeyword(match.self.uin, normalizedKeyword)) {
    return `命中自己 ID: ${match.self.uin}`
  }

  if (includesKeyword(match.self.name, normalizedKeyword)) {
    return `命中自己名字: ${match.self.name}`
  }

  return '命中历史对局'
}

function buildSearchCandidates(matches: MatchRecord[]) {
  return matches.flatMap((match) =>
    match.teammateNames
      .filter(Boolean)
      .map((teammateName) => ({
        playerKey: teammateName.trim().toLowerCase(),
        playerName: teammateName.trim(),
        matchId: match.id,
        mapName: match.mapName,
        teamId: match.teamId,
        endReason: match.endReason,
        startedAt: match.startedAt,
        sourceFiles: match.sourceFiles,
      })),
  )
}

function formatMatchEvidence(match: SearchCandidate) {
  const timeLabel = formatDateTime(match.startedAt)
  return `${timeLabel} · ${match.mapName} · ${match.endReason}`
}

function buildRelationSummary(playerName: string, count: number) {
  if (count <= 1) {
    return `你曾与 ${playerName} 同队 1 次`
  }

  return `你曾与 ${playerName} 同队 ${count} 次`
}

function buildRelationCards(matches: MatchRecord[], query: string): SearchResultCard[] {
  const candidates = buildSearchCandidates(matches)
  const fuse = new Fuse(candidates, {
    includeScore: true,
    threshold: 0.34,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [{ name: 'playerName', weight: 1 }],
  })

  const hits = fuse.search(query).map((item) => item.item)
  const groups = new Map<string, SearchCandidate[]>()

  for (const hit of hits) {
    const current = groups.get(hit.playerKey) ?? []
    current.push(hit)
    groups.set(hit.playerKey, current)
  }

  return [...groups.entries()]
    .map(([playerKey, playerMatches]) => {
      const uniqueMatches = new Map(playerMatches.map((match) => [match.matchId, match]))
      const matchList = [...uniqueMatches.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      const latestMatch = matchList[0]
      const teammateCount = matchList.length

      // 当前日志样本只稳定支持“同队”关系，击杀关系先把卡片结构预留出来，
      // 后续补齐 kill_events 后可以直接复用这套 UI。
      const card: SearchResultCard = {
        playerKey,
        playerName: latestMatch.playerName,
        playerUin: null,
        primaryRelation: 'teammate',
        relationCounts: {
          teammate: teammateCount,
          killed_me: 0,
          killed_by_me: 0,
        },
        summaryText: buildRelationSummary(latestMatch.playerName, teammateCount),
        detailText: `最近一次同队发生在 ${formatDateTime(latestMatch.startedAt)}，地图 ${latestMatch.mapName}`,
        evidence: matchList.slice(0, 3).map(formatMatchEvidence),
        latestMatchId: latestMatch.matchId,
        latestEventAt: latestMatch.startedAt,
        latestMapName: latestMatch.mapName,
        latestEndReason: latestMatch.endReason,
      }

      return card
    })
    .sort((left, right) => right.latestEventAt.localeCompare(left.latestEventAt))
}

export function buildSearchView(matches: MatchRecord[], query: string): SearchView {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return {
      query: '',
      summary: null,
      cards: [],
    }
  }

  const cards = buildRelationCards(matches, normalizedQuery)
  const teammateCards = cards.filter((item) => item.primaryRelation === 'teammate').length
  const killedMeCards = cards.filter((item) => item.primaryRelation === 'killed_me').length
  const killedByMeCards = cards.filter((item) => item.primaryRelation === 'killed_by_me').length

  return {
    query: normalizedQuery,
    summary: {
      keyword: normalizedQuery,
      totalCards: cards.length,
      teammateCards,
      killedMeCards,
      killedByMeCards,
      capabilityNote: '当前版本已稳定展示历史同队；击杀关系卡已预留，待日志样本补齐后直接启用。',
    },
    cards,
  }
}
