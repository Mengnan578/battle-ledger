import { Bug, Clock3, Rocket } from 'lucide-react'

import { useReleaseData } from '@/hooks/useReleaseData'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN')
}

export function ChangelogPage() {
  const { changelog, loading, error } = useReleaseData()

  return (
    <main className="page page--changelog">
      <section className="story-card">
        <div className="section-label">更新说明</div>
        <h1>战痕仪 Demo 发布记录</h1>
        <p className="muted-copy">
          当前阶段先验证桌宠、自动识别熟人队友、轻量搜索与详情链路。后续会继续补击杀关系、正式更新机制与更完整的版本分发。
        </p>
      </section>

      {loading ? <section className="story-card">正在读取更新记录...</section> : null}
      {error ? <section className="story-card">{error}</section> : null}

      <section className="timeline">
        {(changelog.length > 0
          ? changelog
          : [
              {
                version: '0.1.0-demo.1',
                publishedAt: '2026-06-12T12:00:00Z',
                title: '首个公开 Demo',
                summary: ['桌宠悬浮入口', '轻量搜索窗', '历史同队关系识别', '详情查看能力'],
              },
            ]
        ).map((item) => (
          <article key={item.version} className="timeline-card">
            <div className="timeline-card__head">
              <span className="status-pill">{item.version}</span>
              <time>{formatDate(item.publishedAt)}</time>
            </div>
            <h2>{item.title}</h2>
            <ul className="bullet-list">
              {item.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="section-grid">
        <article className="info-card">
          <span className="info-card__icon">
            <Rocket size={18} />
          </span>
          <h2>下一阶段</h2>
          <p>补齐击杀关系解析、正式接入发布流水线，并支持客户端内检测新版本。</p>
        </article>

        <article className="info-card">
          <span className="info-card__icon">
            <Clock3 size={18} />
          </span>
          <h2>Demo 节奏</h2>
          <p>官网会始终展示当前最新可下载版本，后续每次发版都能自动同步到下载页。</p>
        </article>

        <article className="info-card">
          <span className="info-card__icon">
            <Bug size={18} />
          </span>
          <h2>已知方向</h2>
          <p>当前先保证体验清晰、发布流程顺畅，再逐步把数据模型和自动更新做完整。</p>
        </article>
      </section>
    </main>
  )
}
