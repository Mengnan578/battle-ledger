# 三角洲玩家记录助手架构设计

## 1. 产品目标

这款工具的核心目标不是“查一条对局”，而是帮助三角洲玩家快速判断某个玩家和自己的历史关系，并且一眼看懂关系强度与风险。

首期围绕 3 类核心关系设计统一搜索体验：

1. 历史同队
2. 对方击杀过我
3. 我击杀过对方

设计原则：

- 简洁：默认只做一件事，输入名字或 ID 后直接看到关系结论。
- 好用：搜索结果先给结论，再给证据，再给详情入口。
- 好看：不做“傻大黑”的黑盒面板，不依赖厚边框堆层次。
- 可扩展：当前日志样本未稳定覆盖击杀关系，架构必须支持未来平滑补齐。
- 不重复造轮子：复用现有 `Fuse.js`、`sql.js`、Electron IPC 和现有详情页能力。

## 2. 当前问题

当前版本存在 4 个结构性问题：

1. 搜索结果只有简单列表，无法一眼区分“同队”“被击杀”“击杀过他”。
2. 搜索主要依赖前端对最近 50 条记录做 Fuse，本质上不是完整历史搜索。
3. 数据模型只有对局和队友，没有击杀事件表，无法稳定支持后两类关系。
4. 界面层次靠深色背景和边框堆叠，视觉太重，容易出现“黑边框感”。

## 3. 目标体验

### 3.1 搜索入口

- 保留桌宠旁的轻量搜索窗口。
- 顶部只保留一个主输入框和 1 行辅助提示。
- 用户按 Enter 后直接展示关系结果。
- 不默认展示统计大段文字，不做复杂筛选面板。

### 3.2 搜索结果结构

搜索结果不再是统一样式列表，而是“关系卡片”。

每张卡片都遵循相同信息层级：

1. 第一眼结论
2. 关系强度
3. 最近一次证据
4. 快速详情入口

### 3.3 三类卡片设计

#### A. 历史同队卡

语义：这个玩家以前和你组过队。

视觉方向：

- 主色：冰蓝 / 青蓝
- 标签：`同队记录`
- 气质：中性、可信、信息型

卡片排版：

- 左上：玩家名 / 玩家 ID
- 右上：关系标签 `同队`
- 中部主文案：`与您历史同队 6 次`
- 次文案：`最近一次 2026-06-10 · 零号大坝 · 房间 123456`
- 底部证据区：显示最近 3 次同队时间点或地图标签
- 右下操作：`查看详情`

推荐摘要字段：

- 同队次数
- 最近一次同队时间
- 最近一次地图
- 是否曾连续多局同队

#### B. 对方击杀过我卡

语义：这个玩家对你有威胁记录。

视觉方向：

- 主色：暖红 / 朱红
- 标签：`曾击杀你`
- 气质：风险提示、危险、需要一眼识别

卡片排版：

- 左上：玩家名 / 玩家 ID
- 右上：关系标签 `危险`
- 中部主文案：`他曾击杀你 3 次`
- 次文案：`最近一次 2026-06-08 · 长弓溪谷 · M4A1`
- 底部证据区：展示最近一次击杀场景和累计次数
- 右下操作：`查看详情`

推荐摘要字段：

- 击杀你次数
- 最近一次击杀时间
- 最近一次地图
- 武器或伤害来源

#### C. 我击杀过对方卡

语义：这个玩家曾被你击杀过。

视觉方向：

- 主色：翠绿 / 青绿
- 标签：`你击杀过他`
- 气质：优势记录、战绩确认

卡片排版：

- 左上：玩家名 / 玩家 ID
- 右上：关系标签 `优势`
- 中部主文案：`你曾击杀他 2 次`
- 次文案：`最近一次 2026-05-30 · 航天基地 · AK-12`
- 底部证据区：展示最近击杀片段和累计交锋次数
- 右下操作：`查看详情`

推荐摘要字段：

- 你击杀他的次数
- 最近一次时间
- 最近一次地图
- 最近一次武器

### 3.4 混合关系

同一个玩家可能同时命中多类关系，例如：

- 既和你同队过，也击杀过你
- 既击杀过你，也被你击杀过

因此最终结果卡需要支持“主关系 + 次关系标签”：

- 主关系用于决定卡片主色和首屏文案
- 次关系用小标签展示，例如 `同队 6`、`击杀你 3`、`被你击杀 2`

主关系优先级建议如下：

1. 对方击杀过我
2. 我击杀过对方
3. 历史同队

原因：

- 玩家更关心威胁关系
- 其次关心战绩关系
- 最后才是普通同队关系

## 4. 视觉规范

### 4.1 整体风格

目标风格：轻量、科幻、干净，不用厚重纯黑面板。

建议视觉原则：

- 背景改为深蓝灰渐变，不用纯黑。
- 卡片用半透明蓝灰玻璃感底色，不用黑色实心块。
- 用柔和阴影和亮度对比建立层次，减少描边。
- 边框只保留极弱 1px 高光边，不做黑边。
- 圆角统一，减少碎片化形状。

### 4.2 配色建议

基础背景：

- 页面背景：深蓝灰渐变
- 卡片背景：`rgba(12, 18, 32, 0.72)` 左右
- 悬浮高光：蓝白低透明度径向光

功能色：

- 同队：蓝色系
- 对方击杀我：红色系
- 我击杀对方：绿色系
- 中性文本：冷灰蓝
- 标题文本：接近白色但不纯白

### 4.3 排版建议

- 搜索窗口宽度建议提升到 560 到 620 之间，高度按结果自适应或提升到 360 到 420。
- 结果卡片用 12 到 16 像素内边距，不堆过多小字。
- 首行只放“玩家主体信息 + 关系标签”。
- 次行只放“核心结论”。
- 第三层才放时间、地图、武器等证据。

## 5. 系统架构

整体采用 4 层结构：

1. 数据采集层
2. 领域建模层
3. 搜索聚合层
4. 结果展示层

### 5.1 数据采集层

职责：

- 监听日志目录
- 解码日志文本
- 解析对局基础信息
- 解析玩家关系事件

现有可复用能力：

- `main.mjs` 中的日志监听和 `sql.js` 持久化逻辑
- 现有 XOR/明文解码能力
- 现有对局起点和队友抽取能力

设计调整：

- 将现有 `main.mjs` 里的“解析 + 建模 + IPC + 窗口”职责拆开。
- 解析逻辑单独放进 `electron/parser/*`。
- 每种日志正则都增加注释，说明样本来源和字段含义。

### 5.2 领域建模层

职责：

- 把原始日志解析成稳定的数据结构
- 用统一表结构承载“对局”“玩家”“关系”“事件”

建议领域对象：

- `MatchRecord`
- `MatchPlayer`
- `KillEvent`
- `PlayerRelationSummary`

### 5.3 搜索聚合层

职责：

- 接收关键词
- 基于名字 / ID / 历史关系做匹配
- 聚合出适合 UI 直接展示的结果卡数据

该层不应直接返回原始对局数组，而应返回“搜索结果视图模型”。

建议输出模型：

```ts
type SearchRelationType = 'teammate' | 'killed_me' | 'killed_by_me'

type SearchResultCard = {
  playerId: string
  playerName: string
  primaryRelation: SearchRelationType
  relationBadges: Array<{
    type: SearchRelationType
    count: number
  }>
  latestEventAt: string | null
  latestMapName: string | null
  latestWeaponName: string | null
  latestMatchId: string | null
  summaryText: string
  evidence: string[]
}
```

### 5.4 结果展示层

职责：

- 只消费 `SearchResultCard[]`
- 不直接理解日志正则和数据库细节
- 只负责卡片排版、状态色和点击详情

这能让 UI 更稳定，也避免现在 `SearchPanel` 直接拿 `MatchRecord[]` 做临时文案拼接。

## 6. 数据模型设计

### 6.1 现有表

当前已有：

- `matches`
- `match_teammates`
- `match_exits`
- `match_sources`

这些表适合首期同队查询，但不足以承载击杀关系。

### 6.2 建议新增表

#### `match_players`

用途：统一保存某局中出现过的玩家。

建议字段：

```sql
match_id TEXT NOT NULL
player_uin TEXT
player_name TEXT NOT NULL
team_id TEXT
is_self INTEGER NOT NULL DEFAULT 0
source TEXT
PRIMARY KEY (match_id, player_name, is_self)
```

说明：

- 首期允许 `player_uin` 为空，因为当前日志样本未必能稳定拿到每位队友的 UIN。
- 该表会逐步替代 `match_teammates`。

#### `kill_events`

用途：保存一条具体击杀事件。

建议字段：

```sql
id TEXT PRIMARY KEY
match_id TEXT NOT NULL
event_at TEXT
killer_uin TEXT
killer_name TEXT
victim_uin TEXT
victim_name TEXT
weapon_name TEXT
damage_source TEXT
distance TEXT
payload_json TEXT
```

说明：

- `payload_json` 用于兜底保存原始片段，避免早期字段判断不完整时丢证据。

#### `player_relations`

用途：搜索聚合加速表，存玩家和我之间的关系统计。

建议字段：

```sql
player_key TEXT PRIMARY KEY
player_uin TEXT
player_name TEXT NOT NULL
teammate_count INTEGER NOT NULL DEFAULT 0
killed_me_count INTEGER NOT NULL DEFAULT 0
killed_by_me_count INTEGER NOT NULL DEFAULT 0
latest_teammate_at TEXT
latest_killed_me_at TEXT
latest_killed_by_me_at TEXT
latest_match_id TEXT
search_text TEXT NOT NULL
```

说明：

- `player_key` 首期可以用 `uin` 优先，否则退回 `name`。
- `search_text` 用于组合名字、ID、别名，提高搜索命中效率。

## 7. 搜索方案

### 7.1 首期方案

首期不建议继续只用前端“最近 50 条本地 Fuse”。

建议改为：

1. 主进程做全量关系聚合
2. 前端调用新的 `searchRelations(keyword)` IPC
3. 主进程返回 `SearchResultCard[]`
4. 前端只做展示

### 7.2 模糊搜索策略

不重复造轮子，直接复用并强化现有 `Fuse.js`：

- 继续使用 `Fuse.js` 做名字和 ID 的模糊排序
- SQLite 负责存储与基础过滤
- 聚合后的关系卡数据再交给 Fuse 排序

不建议首期自写模糊评分器。

### 7.3 为什么不用只靠 SQL

因为玩家名字可能有：

- 简写
- 特殊字符
- 拼写接近
- 中文和数字混合

`Fuse.js` 在这些场景下比手写 `LIKE` 更合适。

## 8. 页面结构设计

### 8.1 搜索页面结构

建议拆成如下组件：

```text
SearchPanel
|- SearchInputBar
|- SearchStateHint
|- SearchResultList
   |- SearchResultCard
      |- RelationBadgeGroup
      |- ResultEvidenceList
      |- ResultActionBar
```

### 8.2 详情页角色

详情页仍然保留，但职责要收窄：

- 搜索页负责“结论”
- 详情页负责“证据”

也就是：

- 搜索页告诉你“这个人和你是什么关系”
- 详情页告诉你“在哪一局、什么时间、什么地图、什么来源文件”

## 9. 代码组织设计

建议新增如下结构：

```text
electron/
|- main.mjs
|- preload.cjs
|- parser/
|  |- decodeLogText.mjs
|  |- parseMatches.mjs
|  |- parseKillEvents.mjs
|- db/
|  |- schema.mjs
|  |- matchRepository.mjs
|  |- relationRepository.mjs
|- services/
|  |- searchService.mjs
|  |- relationAggregationService.mjs
|- windows/
|  |- createMainWindow.mjs
|  |- createSearchWindow.mjs
|  |- createFloatingWindow.mjs

src/
|- features/
|  |- search/
|  |  |- SearchPanel.tsx
|  |  |- SearchPanel.css
|  |  |- components/
|  |  |  |- SearchInputBar.tsx
|  |  |  |- SearchResultCard.tsx
|  |  |  |- RelationBadgeGroup.tsx
|  |  |- searchViewModel.ts
|  |- detail/
|  |  |- DetailPage.tsx
|  |  |- DetailPage.css
|- services/
|  |- battleLedger.ts
|- types/
|  |- battleLedger.ts
|  |- search.ts
```

## 10. 注释规范

这次实现时要补的是“解释型注释”，不是流水账注释。

建议规则：

- 正则解析前写注释，说明这段日志样本来自哪里、为什么这样取字段。
- 聚合逻辑前写注释，说明为什么按这个优先级判定主关系。
- UI 映射前写注释，说明不同关系卡的颜色和摘要文案如何决定。
- 不写“给变量赋值”这种无意义注释。

示例：

```ts
// 主关系优先级用于决定结果卡主色。
// 风险关系优先于战绩关系，再优先于普通同队关系，
// 这样用户能先看到最重要的信息。
```

## 11. 建议使用的库

保留并继续使用：

- `Fuse.js`
- `sql.js`

建议新增：

- `lucide-react`
  - 用于结果卡中的轻量图标，不自己画图标。
- `zod`
  - 用于 IPC 返回结构和解析结果校验，避免后续字段膨胀后混乱。

可选新增：

- `motion`
  - 仅用于结果卡轻微进入动画和悬停反馈，不做花哨大动画。

不建议引入完整重量级 UI 框架，因为当前是桌宠 + 小窗口产品，定制成本低于框架适配成本。

## 12. 分阶段实施

### Phase 1：搜索体验重构

目标：

- 接管当前搜索结果展示
- 输出三类关系卡 UI
- 改掉“黑边框感”

范围：

- 重构 `SearchPanel`
- 改造 `searchUtils`
- 新增关系卡组件
- 搜索窗口尺寸和视觉升级

### Phase 2：数据模型升级

目标：

- 用 `match_players` 替代简单 `match_teammates`
- 为击杀事件预留结构

范围：

- SQLite schema 迁移
- 主进程 repository 拆分
- 补索引与聚合逻辑

### Phase 3：击杀关系落地

前提：

- 拿到稳定日志样本

目标：

- 真正支持“对方击杀过我”和“我击杀过对方”

范围：

- 新增 `parseKillEvents`
- 写入 `kill_events`
- 聚合 `player_relations`
- 前端展示红/绿关系卡

## 13. 交付建议

建议按下面顺序推进，而不是一次性大改：

1. 先确认这份架构和 UI 方案
2. 再做搜索结果 UI 和窗口视觉升级
3. 再做后端搜索聚合改造
4. 最后基于真实日志样本补齐击杀关系

这样可以保证：

- 先把“看起来清楚、用起来舒服”做出来
- 再把“击杀关系是否可靠”分阶段落地

