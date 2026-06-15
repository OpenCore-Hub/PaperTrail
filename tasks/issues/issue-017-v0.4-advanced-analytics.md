# [ISSUE-017] v0.4 Advanced Analytics

## 目标

在 v0.3 事件流基础上构建高级分析能力：漏斗、留存、AI 交互分析、地理/设备分布、CSV/Excel 导出，为 Dataroom 运营和计费用量提供数据支撑。

## 关联 ADR

- `docs/adr/001-v0.3-ai-native-dataroom-and-document-persistence.md` 第 10 节 Phase 4
- `docs/adr/002-v0.4-dataroom-intelligence-layer-and-growth-stack.md` 第 6 节（E6）

## 已确认决策

- 事件采集基于 Redis Streams（v0.3 已预留）。
- 热数据 7 天存 Redis，温数据 90 天存 PostgreSQL，冷数据归档到 S3/Local。
- 分析维度：views、unique viewers、downloads、avg duration、ai queries、funnel、retention、geo/device/browser。

## 阶段一：事件采集与聚合（Day 1-3）

- [ ] **T1.1** 确认/实现事件发布到 Redis Streams
  - 事件类型：`DOCUMENT_VIEWED`、`DOCUMENT_DOWNLOADED`、`LINK_CREATED`、`DATAROOM_ACCESSED`、`AGREEMENT_SIGNED`、`AI_QUESTION_ASKED`、`PAGE_VIEWED`
- [ ] **T1.2** 新增 Prisma 模型 `AnalyticsDaily`
  - 字段：`workspaceId`、`documentId`、`dataroomId`、`date`、`views`、`uniqueViewers`、`downloads`、`avgDuration`、`aiQueries`
- [ ] **T1.3** 实现聚合 worker：从 Redis Streams 消费并写入 `AnalyticsDaily`
- [ ] **T1.4** 生成 migration 并运行 `npx prisma generate`

## 阶段二：分析 API（Day 4-6）

- [ ] **T2.1** 实现 `GET /api/analytics/overview`
  - 按 workspace / document / dataroom 返回 views、downloads、unique viewers
- [ ] **T2.2** 实现 `GET /api/analytics/funnel`
  - Link Created → Viewed → Downloaded → Agreement Signed
- [ ] **T2.3** 实现 `GET /api/analytics/retention`
  - 7/30 天回访率
- [ ] **T2.4** 实现 AI 交互分析 API
  - 最常问的问题、AI 答案采纳率（间接通过 suggestion apply 计算）
- [ ] **T2.5** 实现地理/设备/浏览器分布查询

## 阶段三：导出与实时 Feed（Day 7-8）

- [ ] **T3.1** 实现 `POST /api/analytics/export`
  - 导出 CSV / Excel
  - 支持按 date range、document、dataroom 过滤
- [ ] **T3.2** 实现实时活动 feed API
  - `GET /api/analytics/activity`
  - 返回最近 50 条事件流（从 Redis Streams 读取）

## 阶段四：前端分析页面（Day 9-10）

- [ ] **T4.1** 前端：Analytics 总览页
  - 展示 views、downloads、unique viewers 趋势
- [ ] **T4.2** 前端：Funnel 与 Retention 图表
- [ ] **T4.3** 前端：AI 交互分析面板
- [ ] **T4.4** 前端：导出按钮与实时活动 feed

## 阶段五：数据保留与测试（Day 11-14）

- [ ] **T5.1** 实现数据保留策略
  - Redis 7 天自动清理
  - PostgreSQL 90 天聚合保留
  - 冷数据归档 job（可选，v0.4 先记录配置）
- [ ] **T5.2** 单元测试：聚合逻辑、漏斗计算
- [ ] **T5.3** 集成测试：事件发布 → 聚合 → API 查询
- [ ] **T5.4** E2E：导出 CSV 并验证字段
- [ ] **T5.5** 分析查询写入 `lib/audit.ts`
- [ ] **T5.6** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 文档查看/下载/AI 提问等事件进入 Redis Streams
- [ ] `AnalyticsDaily` 能按天聚合 workspace/document/dataroom 数据
- [ ] 漏斗分析展示 Link → View → Download → Agreement 转化
- [ ] 用户能导出 CSV/Excel 分析报告
- [ ] 实时活动 feed 展示最近事件

## 风险 / 注意事项

1. **事件顺序与去重**：Redis Streams 保证至少一次投递，聚合 worker 需幂等。
2. **隐私合规**：地理位置数据需匿名化，避免存储精确个人位置。
3. **性能**：大热 workspace 的事件量可能很大，聚合 worker 需支持批量与背压。

## 依赖

- ISSUE-001（DocumentVersion / Document 模型）
- ISSUE-002（Dataroom 模型）
- ISSUE-003（Agreement Signed 事件）
- ISSUE-004（AI Infrastructure，AI_QUESTION_ASKED 事件）
- ISSUE-008（Workflows 可复用 Redis Streams 基础设施）

## 预估工期

2 周
