import { ArrowRight, BellRing, Download, Search, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { featureCards, scenarioSteps, trustNotes } from '@/data/siteContent'
import { useReleaseData } from '@/hooks/useReleaseData'

function formatDateTime(value?: string) {
  if (!value) {
    return '即将发布'
  }

  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function HomePage() {
  const { latest } = useReleaseData()

  return (
    <main className="page page--home">
      <section className="hero-card">
        <div className="hero-card__content">
          <div className="hero-chip">
            <Sparkles size={14} />
            <span>三角洲玩家战局关系助手</span>
          </div>
          <h1>让熟人队友、历史同队和危险对手，在进入游戏时就被看见。</h1>
          <p className="hero-copy">
            `战痕仪` 是一款基于 Electron 的桌面记录助手。它以桌宠形态常驻桌面，读取本地日志，帮助玩家自动识别熟人队友，并补充轻量搜索与详情追溯能力。
          </p>

          <div className="hero-actions">
            <Link to="/download" className="button button--primary">
              下载 Demo
              <Download size={16} />
            </Link>
            <Link to="/changelog" className="button button--ghost">
              查看更新
              <ArrowRight size={16} />
            </Link>
          </div>

          <dl className="hero-stats">
            <div>
              <dt>最新版本</dt>
              <dd>{latest?.version ?? '0.1.0-demo.1'}</dd>
            </div>
            <div>
              <dt>发布状态</dt>
              <dd>{latest?.channel ?? 'demo'}</dd>
            </div>
            <div>
              <dt>发布时间</dt>
              <dd>{formatDateTime(latest?.publishedAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="pet-showcase">
            <div className="pet-showcase__bubble">
              <BellRing size={16} />
              <span>本局发现 2 名熟人队友</span>
            </div>
            <div className="pet-showcase__search">
              <Search size={16} />
              <span>输入玩家名或 ID，按回车确认</span>
            </div>
            <div className="pet-showcase__mascot">
              <span className="pet-showcase__ear pet-showcase__ear--left" />
              <span className="pet-showcase__ear pet-showcase__ear--right" />
              <span className="pet-showcase__head">
                <span className="pet-showcase__badge">战</span>
                <span className="pet-showcase__face" />
              </span>
              <span className="pet-showcase__body" />
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid">
        {featureCards.map((item) => {
          const Icon = item.icon
          return (
            <article key={item.title} className="info-card">
              <span className="info-card__icon">
                <Icon size={18} />
              </span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          )
        })}
      </section>

      <section className="split-panel">
        <article className="story-card">
          <div className="section-label">使用方式</div>
          <h2>尽可能少地打断玩家，只在需要时给出清晰提醒。</h2>
          <ol className="step-list">
            {scenarioSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="story-card story-card--compact">
          <div className="section-label">为什么是它</div>
          <h2>它不是一块傻大黑的工具面板，而是一个可感知、可查询、可持续更新的桌面助手。</h2>
          <div className="trust-list">
            {trustNotes.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="trust-item">
                  <span className="trust-item__icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </section>
    </main>
  )
}
