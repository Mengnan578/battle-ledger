import type { LucideIcon } from 'lucide-react'
import { BellRing, Crosshair, Download, ShieldCheck, Users, Workflow } from 'lucide-react'

export const featureCards: Array<{
  title: string
  description: string
  icon: LucideIcon
}> = [
  {
    title: '自动识别熟人队友',
    description: '进入游戏后读取本地日志，自动比对历史战局，命中熟人队友时由桌宠即时提醒。',
    icon: BellRing,
  },
  {
    title: '历史同队关系追踪',
    description: '输入玩家名或 ID，即可快速回看你们曾经一起匹配的次数、地图和最近一次证据。',
    icon: Users,
  },
  {
    title: '击杀关系可扩展',
    description: '当前 Demo 已为击杀你、被你击杀两类关系预留结构，后续可直接无缝接入。',
    icon: Crosshair,
  },
  {
    title: 'Electron 桌面体验',
    description: '桌宠常驻桌面，不打断游戏流程；后续将接入正式自动更新，让玩家始终获取最新版本。',
    icon: Download,
  },
]

export const scenarioSteps = [
  '启动战痕仪，桌宠轻量常驻桌面。',
  '进入三角洲对局后，本地日志被自动扫描。',
  '命中历史队友时，桌宠立刻给出熟人提示。',
  '需要进一步确认时，再点击桌宠打开搜索框。',
  '命中记录后进入详情页，查看地图、时间、来源和同队信息。',
]

export const trustNotes = [
  {
    title: '只读取本地日志',
    description: '首版聚焦在玩家本地日志解析，不依赖远端账号体系，降低使用门槛。',
    icon: ShieldCheck,
  },
  {
    title: '演示版先做对体验',
    description: 'Demo 重点先验证桌宠、自动提醒、关系搜索与详情链路，再逐步扩展数据深度。',
    icon: Workflow,
  },
]
