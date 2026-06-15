import { useEffect, useMemo, useState } from 'react'

import { DetailPage } from './features/detail/DetailPage'
import './features/detail/DetailPage.css'
import { FloatingPet } from './features/floating/FloatingPet'
import './features/floating/FloatingPet.css'
import { SearchPanel } from './features/search/SearchPanel'
import './features/search/SearchPanel.css'
import { buildSearchView } from './features/search/searchUtils'
import { fetchAppState, subscribeAppState, subscribeSearchPanelVisibility } from './services/battleLedger'
import './styles/ui.css'
import type { AppState } from './types/battleLedger'
import { fallbackState } from './types/battleLedger'

function getRouteInfo(hash: string) {
  const normalizedHash = hash.replace(/^#/, '')

  if (normalizedHash.startsWith('floating')) {
    return {
      mode: 'floating' as const,
      matchId: '',
    }
  }

  if (normalizedHash.startsWith('search')) {
    return {
      mode: 'search' as const,
      matchId: '',
    }
  }

  if (normalizedHash.startsWith('detail/')) {
    return {
      mode: 'detail' as const,
      matchId: decodeURIComponent(normalizedHash.slice('detail/'.length)),
    }
  }

  return {
    mode: 'detail' as const,
    matchId: '',
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(fallbackState)
  const [playerKeyword, setPlayerKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [busy, setBusy] = useState(false)
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    fetchAppState().then((payload) => {
      setAppState(payload)
    })

    const unsubscribe = subscribeAppState((payload) => {
      setAppState(payload)
    })

    const handleHashChange = () => {
      setHash(window.location.hash)
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      unsubscribe()
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const route = useMemo(() => getRouteInfo(hash), [hash])
  const isSearchPanel = route.mode === 'search'
  const searchView = useMemo(() => buildSearchView(appState.matches, submittedKeyword), [appState.matches, submittedKeyword])

  useEffect(() => {
    if (!isSearchPanel) {
      return
    }

    return subscribeSearchPanelVisibility((visible) => {
      if (!visible) {
        setPlayerKeyword('')
        setSubmittedKeyword('')
        setBusy(false)
      }
    })
  }, [isSearchPanel])

  const handleSearch = async () => {
    const nextKeyword = playerKeyword.trim()
    setBusy(true)
    setSubmittedKeyword(nextKeyword)
    setBusy(false)
  }

  if (route.mode === 'floating') {
    return <FloatingPet appState={appState} />
  }

  if (route.mode === 'search') {
    return (
      <SearchPanel
        view={searchView}
        busy={busy}
        playerKeyword={playerKeyword}
        setPlayerKeyword={setPlayerKeyword}
        onSearch={handleSearch}
      />
    )
  }

  return <DetailPage appName={appState.settings.appName} matchId={route.matchId} />
}
