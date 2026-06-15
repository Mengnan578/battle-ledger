import { Download, ExternalLink, HardDriveDownload, LaptopMinimalCheck } from 'lucide-react'

import { useReleaseData } from '@/hooks/useReleaseData'

function formatDateTime(value?: string) {
  if (!value) {
    return '待生成'
  }

  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function DownloadPage() {
  const { latest, loading, error } = useReleaseData()

  return (
    <main className="page page--download">
      <section className="download-hero">
        <div>
          <div className="section-label">下载 Demo</div>
          <h1>获取最新版战痕仪</h1>
          <p>
            当前官网会直接展示最新发布版本。后续你更新 Electron 应用后，只需要执行统一发布流程，下载页就会同步展示最新版。
          </p>
        </div>

        <article className="download-card">
          <div className="download-card__header">
            <span className="status-pill">{latest?.channel ?? 'demo'}</span>
            <strong>{latest?.version ?? '0.1.0-demo.1'}</strong>
          </div>

          {loading ? <p className="muted-copy">正在读取最新版本信息...</p> : null}
          {error ? <p className="muted-copy">{error}</p> : null}

          <dl className="download-meta">
            <div>
              <dt>平台</dt>
              <dd>Windows</dd>
            </div>
            <div>
              <dt>文件名</dt>
              <dd>{latest?.fileName ?? 'BattleLedger-Setup.exe'}</dd>
            </div>
            <div>
              <dt>发布时间</dt>
              <dd>{formatDateTime(latest?.publishedAt)}</dd>
            </div>
            <div>
              <dt>安装包大小</dt>
              <dd>{latest?.fileSize ?? '待生成'}</dd>
            </div>
          </dl>

          <div className="download-actions">
            <a className="button button--primary" href={latest?.downloadUrl ?? '#'} target="_blank" rel="noreferrer">
              下载安装包
              <Download size={16} />
            </a>
            <a className="button button--ghost" href={latest?.releasePageUrl ?? '#'} target="_blank" rel="noreferrer">
              查看 Release
              <ExternalLink size={16} />
            </a>
          </div>
        </article>
      </section>

      <section className="section-grid">
        <article className="info-card">
          <span className="info-card__icon">
            <LaptopMinimalCheck size={18} />
          </span>
          <h2>安装建议</h2>
          <p>建议在桌面 Windows 环境下载并安装，首次运行时允许读取本地日志目录，便于自动识别队友关系。</p>
        </article>

        <article className="info-card">
          <span className="info-card__icon">
            <HardDriveDownload size={18} />
          </span>
          <h2>后续更新</h2>
          <p>后续将接入 `electron-updater`，让用户在客户端内直接获取新版本，不需要反复手动找安装包。</p>
        </article>
      </section>

      <section className="story-card">
        <div className="section-label">本次版本包含</div>
        <ul className="bullet-list">
          {(latest?.notes ?? ['桌宠悬浮入口', '轻量搜索弹窗', '历史同队关系卡', '详情页查看']).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
