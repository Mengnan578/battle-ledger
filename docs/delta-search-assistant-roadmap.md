# 三角洲玩家记录助手实施路线

## 1. 本次改造边界

本次先做“设计确认”，不直接大改实现。

原因：

- 当前“同队”已能做，但“击杀 / 被击杀”数据还没有稳定落库。
- 如果先硬写界面，再回头改数据结构，返工会很大。
- 用户目标明确要求先做设计，再开始写代码。

## 2. 实施原则

1. 不重复造轮子
2. 先改结构，再改样式
3. 先做结果视图模型，再做结果卡 UI
4. 对击杀关系严格证据驱动，不臆造字段

## 3. 代码拆分计划

### 3.1 Electron 主进程

当前 `electron/main.mjs` 职责过多，后续拆分为：

- `parser/`
  - 负责日志解码和正则抽取
- `db/`
  - 负责 schema、查询、写入
- `services/`
  - 负责关系聚合与搜索
- `windows/`
  - 负责创建窗口和窗口行为

拆分收益：

- 降低主文件复杂度
- 让“数据逻辑”和“窗口逻辑”分离
- 方便未来继续加击杀关系而不把窗口代码污染掉

### 3.2 前端搜索模块

后续搜索模块拆分为：

- `SearchPanel.tsx`
  - 页面容器
- `SearchInputBar.tsx`
  - 输入框和回车行为
- `SearchResultList.tsx`
  - 列表状态
- `SearchResultCard.tsx`
  - 单条结果卡
- `RelationBadgeGroup.tsx`
  - 关系标签组
- `searchViewModel.ts`
  - 把后端结果映射成前端展示文案

拆分收益：

- 避免当前 `SearchPanel` 又做输入又做映射又做渲染
- 卡片样式和文案逻辑更容易单独优化

## 4. API 设计

### 4.1 新增 IPC

建议新增：

```ts
searchRelations(keyword: string): Promise<SearchResultCard[]>
```

职责：

- 在主进程中完成全量关系搜索和排序
- 前端只负责展示

### 4.2 保留 IPC

继续保留：

- `getState`
- `getMatchDetail`
- `openMatchDetails`
- `toggleSearchPanel`

原因：

- 详情页跳转链路已经稳定
- 不需要推翻当前桌宠和详情窗口模型

## 5. 关系聚合策略

### 5.1 玩家唯一键

优先级：

1. `player_uin`
2. `player_name`

说明：

- 如果日志能拿到稳定 UIN，就按 UIN 聚合。
- 如果拿不到，只能按名字聚合，但要在文档和代码注释中明确说明这会有重名误判风险。

### 5.2 主关系判定

规则：

1. `killed_me_count > 0` 时主关系为 `killed_me`
2. 否则如果 `killed_by_me_count > 0`，主关系为 `killed_by_me`
3. 否则如果 `teammate_count > 0`，主关系为 `teammate`

### 5.3 摘要文案生成

摘要文案不直接写死在组件里，而是通过 view model 统一生成。

示例：

```ts
function buildPrimarySummary(result: SearchResultCard) {
  switch (result.primaryRelation) {
    case 'killed_me':
      return `他曾击杀你 ${result.relationCounts.killed_me} 次`
    case 'killed_by_me':
      return `你曾击杀他 ${result.relationCounts.killed_by_me} 次`
    case 'teammate':
      return `与你历史同队 ${result.relationCounts.teammate} 次`
  }
}
```

## 6. UI 改造计划

### 6.1 搜索窗口

目标：

- 不再像一个黑盒输入框
- 改成轻量悬浮情报面板

改造项：

- 增大窗口宽高
- 调亮面板底色
- 减少硬边框
- 优化滚动区留白和卡片间距

### 6.2 结果卡

每张结果卡固定分为 4 个区域：

1. 玩家主体区
2. 主关系结论区
3. 证据区
4. 操作区

这样用户不需要读完整行文字，就知道是什么关系。

### 6.3 空状态

空状态不再写“没有命中记录”的黑框提示。

建议改为：

- 淡色说明
- 轻图标
- 简短引导文案

## 7. 推荐依赖

### 7.1 直接采用

- `Fuse.js`
  - 已在项目中使用，继续承担模糊排序。
- `sql.js`
  - 已在项目中使用，继续承担本地数据持久化。

### 7.2 建议新增

- `lucide-react`
  - 用于关系图标和空状态图标。
- `zod`
  - 用于 IPC 数据结构校验。

### 7.3 暂不建议

- 完整组件库
  - 当前是小而精的桌面工具，重型 UI 库收益不高。
- 自写图标系统
  - 成本高，没有必要。

## 8. 详细任务拆解

### 任务 A：重构搜索结果模型

文件范围：

- `src/types/`
- `src/features/search/searchViewModel.ts`
- `electron/services/searchService.mjs`

完成标准：

- 前端不再直接消费 `MatchRecord[]` 当搜索结果
- 搜索页直接消费 `SearchResultCard[]`

### 任务 B：重构搜索 UI

文件范围：

- `src/features/search/SearchPanel.tsx`
- `src/features/search/SearchPanel.css`
- `src/features/search/components/*`

完成标准：

- 三类关系卡的视觉和文案清晰区分
- 无厚重黑边框
- 搜索结果一眼可辨

### 任务 C：升级数据模型

文件范围：

- `electron/db/schema.mjs`
- `electron/db/*Repository.mjs`
- `src/types/battleLedger.ts`

完成标准：

- 引入 `match_players`
- 为 `kill_events` 和 `player_relations` 预留落表结构

### 任务 D：补齐击杀关系

文件范围：

- `electron/parser/parseKillEvents.mjs`
- `electron/services/relationAggregationService.mjs`

完成标准：

- 有真实样本支撑
- 可稳定回放“谁击杀了谁”

## 9. 风险与前置条件

### 风险 1：击杀日志字段不稳定

应对：

- 先保存原始事件片段
- 字段确认前不做过度结构化

### 风险 2：玩家名重名

应对：

- 优先使用 UIN
- 没有 UIN 时在界面上保留风险说明

### 风险 3：窗口过小导致卡片排版拥挤

应对：

- 搜索窗口尺寸同步升级
- 只展示最关键的 2 到 3 条证据

## 10. 建议开发顺序

建议严格按下面顺序推进：

1. 确认本设计稿
2. 先实现新的搜索结果卡和视觉风格
3. 接入主进程关系搜索 API
4. 再做数据库升级
5. 最后补击杀关系解析

原因：

- 先把“能看懂、够好看”的基础体验做出来
- 再补底层能力，整体风险最低

