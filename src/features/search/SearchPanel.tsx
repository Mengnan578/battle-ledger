import { useEffect, useRef } from 'react'

import { openMatchDetails } from '../../services/battleLedger'
import { formatDateTime, type SearchRelationType, type SearchResultCard, type SearchView } from './searchUtils'

type SearchPanelProps = {
  view: SearchView
  busy: boolean
  playerKeyword: string
  setPlayerKeyword: (value: string) => void
  onSearch: () => Promise<void>
}

export function SearchPanel({ view, busy, playerKeyword, setPlayerKeyword, onSearch }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <main className={`search-panel-page${view.query ? '' : ' search-panel-page--compact'}`}>
      <section className={`search-panel-card${view.query ? '' : ' search-panel-card--compact'}`}>
        <div className="search-toolbar">
          <input
            ref={inputRef}
            className="search-input search-input--solo"
            value={playerKeyword}
            onChange={(event) => setPlayerKeyword(event.target.value)}
            placeholder={busy ? '搜索中...' : '输入玩家名或 ID，按回车确认'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void onSearch()
              }
            }}
          />
        </div>

        {view.query ? (
          <div className="search-results">
            {view.cards.length === 0 ? (
              <div className="search-result search-result--empty">
                <strong>没有找到相关记录</strong>
                <span>当前还没有搜到包含“{view.query}”的历史关系记录。</span>
              </div>
            ) : (
              view.cards.map((card) => <RelationCard key={card.playerKey} card={card} />)
            )}
          </div>
        ) : null}
      </section>
    </main>
  )
}

function getRelationSummaryLabel(type: SearchRelationType) {
  switch (type) {
    case 'killed_me':
      return '曾击杀你'
    case 'killed_by_me':
      return '被你击杀'
    case 'teammate':
    default:
      return '历史同队'
  }
}

function RelationCard({ card }: { card: SearchResultCard }) {
  const badgeEntries: Array<{ type: SearchRelationType; count: number }> = [
    { type: 'teammate' as SearchRelationType, count: card.relationCounts.teammate },
    { type: 'killed_me' as SearchRelationType, count: card.relationCounts.killed_me },
    { type: 'killed_by_me' as SearchRelationType, count: card.relationCounts.killed_by_me },
  ].filter((item) => item.count > 0)

  return (
    <article className={`relation-card relation-card--${card.primaryRelation}`}>
      <header className="relation-card__header">
        <div className="relation-card__identity">
          <span className={`relation-card__accent relation-card__accent--${card.primaryRelation}`}>
            {getRelationSummaryLabel(card.primaryRelation)}
          </span>
          <strong>{card.playerName}</strong>
        </div>
        <div className="relation-card__badges">
          {badgeEntries.map((item) => (
            <span key={item.type} className={`relation-badge relation-badge--${item.type}`}>
              {item.count}
            </span>
          ))}
        </div>
      </header>

      <section className="relation-card__body">
        <strong className="relation-card__summary">{card.summaryText}</strong>
        <p className="relation-card__detail">
          {formatDateTime(card.latestEventAt)} · {card.latestMapName} · {card.latestEndReason}
        </p>
      </section>

      <footer className="relation-card__footer">
        <button
          type="button"
          className="ghost-button search-result__action"
          onClick={() => {
            openMatchDetails(card.latestMatchId)
          }}
        >
          查看详情
        </button>
      </footer>
    </article>
  )
}
