import { useEffect, useState } from 'react'

import type { ChangelogItem, ReleaseManifest } from '@/types/release'

type ReleaseState = {
  latest: ReleaseManifest | null
  changelog: ChangelogItem[]
  loading: boolean
  error: string
}

const initialState: ReleaseState = {
  latest: null,
  changelog: [],
  loading: true,
  error: '',
}

export function useReleaseData() {
  const [state, setState] = useState<ReleaseState>(initialState)

  useEffect(() => {
    let active = true
    const basePath = import.meta.env.BASE_URL

    Promise.all([
      fetch(`${basePath}releases/latest.json`).then((response) => response.json() as Promise<ReleaseManifest>),
      fetch(`${basePath}releases/changelog.json`).then((response) => response.json() as Promise<ChangelogItem[]>),
    ])
      .then(([latest, changelog]) => {
        if (!active) {
          return
        }

        setState({
          latest,
          changelog,
          loading: false,
          error: '',
        })
      })
      .catch(() => {
        if (!active) {
          return
        }

        setState({
          latest: null,
          changelog: [],
          loading: false,
          error: '版本信息读取失败，请稍后再试。',
        })
      })

    return () => {
      active = false
    }
  }, [])

  return state
}
