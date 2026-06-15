import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const websiteReleaseDir = path.join(rootDir, 'website', 'public', 'releases')
const latestFilePath = path.join(websiteReleaseDir, 'latest.json')
const changelogFilePath = path.join(websiteReleaseDir, 'changelog.json')

const version = process.env.RELEASE_VERSION ?? '0.1.0-demo.1'
const channel = process.env.RELEASE_CHANNEL ?? 'demo'
const publishedAt = process.env.RELEASE_PUBLISHED_AT ?? new Date().toISOString()
const downloadUrl =
  process.env.RELEASE_DOWNLOAD_URL ??
  `https://github.com/Mengnan578/battle-ledger/releases/download/v${version}/BattleLedger-Setup-${version}.exe`
const releasePageUrl =
  process.env.RELEASE_PAGE_URL ??
  `https://github.com/Mengnan578/battle-ledger/releases/tag/v${version}`
const fileName = process.env.RELEASE_FILE_NAME ?? `BattleLedger-Setup-${version}.exe`
const fileSize = process.env.RELEASE_FILE_SIZE ?? '待发布'
const checksum = process.env.RELEASE_CHECKSUM ?? ''
const releaseTitle = process.env.RELEASE_TITLE ?? 'Demo 发布'
const notes = (process.env.RELEASE_NOTES ?? '新增桌宠入口|新增轻量搜索|新增详情页')
  .split('|')
  .map((item) => item.trim())
  .filter(Boolean)

async function readJson(filePath, fallbackValue) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch {
    return fallbackValue
  }
}

async function main() {
  await fs.mkdir(websiteReleaseDir, { recursive: true })

  const latestPayload = {
    version,
    channel,
    publishedAt,
    downloadUrl,
    fileName,
    fileSize,
    notes,
    checksum,
    releasePageUrl,
  }

  const existingChangelog = await readJson(changelogFilePath, [])
  const nextEntry = {
    version,
    publishedAt,
    title: releaseTitle,
    summary: notes,
  }

  const changelogPayload = [nextEntry, ...existingChangelog.filter((item) => item.version !== version)]

  await fs.writeFile(latestFilePath, `${JSON.stringify(latestPayload, null, 2)}\n`, 'utf8')
  await fs.writeFile(changelogFilePath, `${JSON.stringify(changelogPayload, null, 2)}\n`, 'utf8')

  console.log(`已生成版本清单: ${version}`)
}

main().catch((error) => {
  console.error('生成版本清单失败', error)
  process.exitCode = 1
})
