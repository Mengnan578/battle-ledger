export type ReleaseManifest = {
  version: string
  channel: 'demo' | 'stable' | 'beta'
  publishedAt: string
  downloadUrl: string
  fileName: string
  fileSize?: string
  notes: string[]
  checksum?: string
  releasePageUrl: string
}

export type ChangelogItem = {
  version: string
  publishedAt: string
  title: string
  summary: string[]
}
