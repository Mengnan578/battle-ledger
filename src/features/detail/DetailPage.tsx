import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'

import {
  endMainDrag,
  fetchMatchDetail,
  minimizeDashboard,
  startMainDrag,
  toggleSearchPanel,
} from '../../services/battleLedger'
import type { MatchRecord } from '../../types/battleLedger'
import { formatDateTime } from '../search/searchUtils'

type DetailPageProps = {
  appName: string
  matchId: string
}

export function DetailPage({ appName, matchId }: DetailPageProps) {
  const [detailMatch, setDetailMatch] = useState<MatchRecord | null>(null)
  const [loading, setLoading] = useState(Boolean(matchId))
  const [error, setError] = useState('')

  useEffect(() => {
    const stopDrag = () => {
      endMainDrag()
    }

    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('blur', stopDrag)

    return () => {
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('blur', stopDrag)
      stopDrag()
    }
  }, [])

  useEffect(() => {
    if (!matchId) {
      setDetailMatch(null)
      setLoading(false)
      setError('')
      return
    }

    let active = true
    setLoading(true)
    setError('')

    fetchMatchDetail(matchId)
      .then((payload) => {
        if (!active) {
          return
        }

        setDetailMatch(payload)
        setError(payload ? '' : '没有找到对应的对局详情。')
      })
      .catch(() => {
        if (!active) {
          return
        }

        setDetailMatch(null)
        setError('读取详情失败，请稍后重试。')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [matchId])

  const handleHeaderMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest('.window-actions, button, input, textarea, select, a')) {
      return
    }

    startMainDrag(event.clientX, event.clientY)
  }

  return (
    <main className="dashboard detail-dashboard">
      <header className="window-bar" onMouseDown={handleHeaderMouseDown}>
        <div className="window-bar__drag-zone">
          <p className="eyebrow">Match Detail</p>
          <h1>{appName}</h1>
        </div>
        <div className="window-actions">
          <button type="button" className="ghost-button" onClick={toggleSearchPanel}>
            打开搜索
          </button>
          <button type="button" className="ghost-button" onClick={minimizeDashboard}>
            收起
          </button>
        </div>
      </header>

      {!matchId ? (
        <section className="detail-empty">
          <strong>先从悬浮搜索里找到目标记录</strong>
          <span>点击桌宠，在旁边输入玩家名字或 ID，命中后再点“详情”。</span>
        </section>
      ) : loading ? (
        <section className="detail-empty">
          <strong>正在加载详情</strong>
          <span>正在读取这条对局的详细信息。</span>
        </section>
      ) : !detailMatch ? (
        <section className="detail-empty">
          <strong>详情暂不可用</strong>
          <span>{error || '没有找到对应记录。'}</span>
        </section>
      ) : (
        <>
          <section className="hero-panel">
            <div>
              <p className="badge">详情页</p>
              <h2>{detailMatch.mapName}</h2>
              <p className="muted">
                {detailMatch.self.name} / {detailMatch.self.uin} / Team {detailMatch.teamId} / 房间{' '}
                {detailMatch.dsRoomId}
              </p>
            </div>
            <div className="hero-panel__meta">
              <div className="meta-card">
                <span>开始时间</span>
                <strong>{formatDateTime(detailMatch.startedAt)}</strong>
              </div>
              <div className="meta-card">
                <span>扫描时间</span>
                <strong>{formatDateTime(detailMatch.scannedAt)}</strong>
              </div>
              <div className="meta-card">
                <span>结束结果</span>
                <strong>{detailMatch.endReason}</strong>
              </div>
            </div>
          </section>

          <section className="grid two-columns">
            <article className="panel">
              <div className="panel__title">
                <div>
                  <p className="eyebrow">同队信息</p>
                  <h3>本局队友</h3>
                </div>
              </div>
              <div className="tags-block">
                {detailMatch.teammateNames.length > 0 ? (
                  detailMatch.teammateNames.map((name) => (
                    <span key={name} className="tag">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="muted">当前记录没有抽到更多同队名字。</span>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel__title">
                <div>
                  <p className="eyebrow">撤离信息</p>
                  <h3>本局可见撤离点</h3>
                </div>
              </div>
              <div className="tags-block">
                {detailMatch.exits.length > 0 ? (
                  detailMatch.exits.map((name) => (
                    <span key={name} className="tag tag--outline">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="muted">当前记录还没有抽到撤离点。</span>
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="panel__title">
              <div>
                <p className="eyebrow">来源</p>
                <h3>日志来源文件</h3>
              </div>
            </div>
            <ul className="details-list">
              <li>来源格式: {detailMatch.sourceFormat}</li>
              <li>来源文件数: {detailMatch.sourceFiles.length}</li>
            </ul>
            <div className="source-file-list">
              {detailMatch.sourceFiles.map((filePath) => (
                <code key={filePath} className="source-file-chip">
                  {filePath}
                </code>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
