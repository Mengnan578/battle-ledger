import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'

import { ChangelogPage } from '@/pages/Changelog'
import { DownloadPage } from '@/pages/Download'
import { HomePage } from '@/pages/Home'

function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <div className="site-shell__glow site-shell__glow--left" aria-hidden="true" />
      <div className="site-shell__glow site-shell__glow--right" aria-hidden="true" />
      <header className="site-header">
        <NavLink to="/" className="brand-mark">
          <span className="brand-mark__badge">战</span>
          <div>
            <strong>战痕仪</strong>
            <span>Delta 玩家战局关系助手</span>
          </div>
        </NavLink>

        <nav className="site-nav" aria-label="主导航">
          <NavLink to="/">首页</NavLink>
          <NavLink to="/download">下载</NavLink>
          <NavLink to="/changelog">更新说明</NavLink>
        </nav>
      </header>

      {children}

      <footer className="site-footer">
        <div>
          <strong>战痕仪 Demo</strong>
          <span>面向三角洲玩家的 Electron 战局关系助手</span>
        </div>
        <p>本地日志识别、轻量桌宠、熟人自动提示、后续支持击杀关系追踪。</p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
        </Routes>
      </SiteLayout>
    </BrowserRouter>
  )
}
