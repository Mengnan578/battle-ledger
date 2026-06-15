import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'

import {
  debugEvent,
  endFloatingDrag,
  startFloatingDrag,
  toggleDashboard,
  toggleSearchPanel,
} from '../../services/battleLedger'
import type { AppState, MatchRecord } from '../../types/battleLedger'

type FloatingPetProps = {
  appState: AppState
}

type AutoTeammateHint = {
  matchId: string
  title: string
  lines: string[]
}

function noopDebug(message: string, extra: Record<string, unknown> = {}) {
  debugEvent({
    hypothesisId: 'A',
    msg: message,
    extra,
    locationHash: window.location.hash,
  })
}

function getMatchSortValue(match: MatchRecord) {
  return match.scannedAt || match.startedAt || ''
}

function buildAutoTeammateHint(matches: MatchRecord[]): AutoTeammateHint | null {
  if (matches.length === 0) {
    return null
  }

  const sortedMatches = [...matches].sort((left, right) => getMatchSortValue(right).localeCompare(getMatchSortValue(left)))
  const latestMatch = sortedMatches[0]
  const latestScanTime = latestMatch.scannedAt ? new Date(latestMatch.scannedAt).getTime() : Number.NaN
  const isRecentScan = Number.isFinite(latestScanTime) && Date.now() - latestScanTime <= 20 * 60 * 1000

  if (!isRecentScan || latestMatch.teammateNames.length === 0) {
    return null
  }

  const teammateHints = latestMatch.teammateNames
    .map((name) => {
      const historyCount = sortedMatches.filter(
        (match) => match.id !== latestMatch.id && match.teammateNames.some((teammateName) => teammateName === name),
      ).length

      return {
        name,
        historyCount,
      }
    })
    .filter((item) => item.historyCount > 0)
    .sort((left, right) => right.historyCount - left.historyCount)

  if (teammateHints.length === 0) {
    return null
  }

  const lines = teammateHints.slice(0, 2).map((item) => `${item.name} 曾同队 ${item.historyCount} 次`)

  if (teammateHints.length > 2) {
    lines.push(`还有 ${teammateHints.length - 2} 名熟人队友`)
  }

  return {
    matchId: latestMatch.id,
    title: teammateHints.length > 1 ? `本局发现 ${teammateHints.length} 名熟人队友` : '本局发现熟人队友',
    lines,
  }
}

export function FloatingPet({ appState }: FloatingPetProps) {
  const dragStateRef = useRef({
    pressed: false,
    dragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const autoHint = useMemo(() => buildAutoTeammateHint(appState.matches), [appState.matches])

  const resetDragState = () => {
    dragStateRef.current = {
      pressed: false,
      dragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    }
  }

  const handleToggle = () => {
    noopDebug('floating.handle-toggle.begin', {
      hasToggleSearchPanel: Boolean(window.battleLedger?.toggleSearchPanel),
    })
    if (window.battleLedger?.toggleSearchPanel) {
      toggleSearchPanel()
      noopDebug('floating.handle-toggle.search-panel', {})
      return
    }

    toggleDashboard()
    noopDebug('floating.handle-toggle.dashboard', {})
  }

  useEffect(() => {
    const handleWindowBlur = () => {
      resetDragState()
      endFloatingDrag()
      noopDebug('floating.blur', {})
    }

    const handleMouseUp = () => {
      if (!dragStateRef.current.pressed) {
        return
      }

      const wasDrag = dragStateRef.current.dragging
      noopDebug('floating.window-mouseup', {
        wasDrag,
        startX: dragStateRef.current.startX,
        startY: dragStateRef.current.startY,
      })
      resetDragState()
      endFloatingDrag()

      if (!wasDrag) {
        handleToggle()
        noopDebug('floating.mouseup.click-open', {})
      } else {
        noopDebug('floating.mouseup.drag-end', {})
      }
    }

    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('mouseup', handleMouseUp)
    noopDebug('floating.mounted', { userAgent: navigator.userAgent })

    return () => {
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const nextOffsetX = Math.round(event.clientX - rect.left)
    const nextOffsetY = Math.round(event.clientY - rect.top)

    noopDebug('floating.mousedown', {
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    })

    if (event.button !== 0) {
      return
    }

    dragStateRef.current = {
      pressed: true,
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    }
  }

  const handleMouseMove = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current.pressed) {
      return
    }

    const deltaX = event.clientX - dragStateRef.current.startX
    const deltaY = event.clientY - dragStateRef.current.startY

    if (!dragStateRef.current.dragging && Math.hypot(deltaX, deltaY) > 6) {
      dragStateRef.current.dragging = true
      const { offsetX, offsetY } = dragStateRef.current
      startFloatingDrag(offsetX, offsetY)
      noopDebug('floating.drag-start', {
        offsetX,
        offsetY,
      })
    }
  }

  return (
    <main className="floating-pet-shell">
      {autoHint ? (
        <aside className="floating-pet__hint" title={autoHint.title}>
          <strong>{autoHint.title}</strong>
          {autoHint.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </aside>
      ) : null}
      <button
        type="button"
        className="floating-pet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDragStart={(event) => event.preventDefault()}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          resetDragState()
          endFloatingDrag()
          handleToggle()
          noopDebug('floating.contextmenu.open', {
            clientX: event.clientX,
            clientY: event.clientY,
          })
        }}
        onWheel={(event) => {
          event.preventDefault()
          event.stopPropagation()
          noopDebug('floating.wheel.prevented', {
            deltaX: event.deltaX,
            deltaY: event.deltaY,
          })
        }}
        title="拖动桌宠，点击搜索"
      >
        <span className="floating-pet__shadow" aria-hidden="true" />
        <span className="floating-pet__spark floating-pet__spark--left" aria-hidden="true" />
        <span className="floating-pet__spark floating-pet__spark--right" aria-hidden="true" />
        <span className="floating-pet__mascot" aria-hidden="true">
          <span className="floating-pet__ear floating-pet__ear--left" />
          <span className="floating-pet__ear floating-pet__ear--right" />
          <span className="floating-pet__head">
            <span className="floating-pet__badge">战</span>
            <span className="floating-pet__face">
              <span className="floating-pet__eyes">
                <span />
                <span />
              </span>
              <span className="floating-pet__mouth" />
            </span>
          </span>
          <span className="floating-pet__torso" />
          <span className="floating-pet__paw floating-pet__paw--left" />
          <span className="floating-pet__paw floating-pet__paw--right" />
        </span>
      </button>
    </main>
  )
}
