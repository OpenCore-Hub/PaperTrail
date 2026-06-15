# [ISSUE-014] v0.5 Federated Search & Knowledge Graph

## 目标

实现跨数据室语义搜索与知识图谱，从文档中提取实体与关系，构建可探索的知识网络。

## 关联 ADR

`docs/adr/003-v0.5-autonomous-document-intelligence-platform.md` 第 7 节

## 已确认决策

- 基于 v0.3 pgvector 做跨文档语义检索。
- 实体类型：人、公司、日期、术语、产品。
- 知识图谱目前按 workspace 级（organization 级共享推迟）。

## 阶段一：Schema & indexing（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型 `KnowledgeEntity`
  - 字段：`id`、`workspaceId`、`type`、`name`、`normalizedName`、`metadata`、`createdAt`
- [ ] **T1.2** 新增 Prisma 模型 `KnowledgeRelation`
  - 字段：`id`、`workspaceId`、`sourceEntityId`、`targetEntityId`、`type`、`documentVersionId`、`confidence`、`createdAt`
- [ ] **T1.3** 在 `DocumentChunk` 上扩展跨 dataroom 索引支持
- [ ] **T1.4** 生成 migration：`npx prisma migrate dev --name knowledge_graph`
- [ ] **T1.5** 运行 `npx prisma generate` 与 `npm run type-check`

## 阶段二：Entity extraction pipeline（Day 4-6）

- [ ] **T2.1** 实现 `lib/ai/jobs/extract-entities.ts`
  - chunk → LLM NER → 归一化 → 存储
- [ ] **T2.2** 定义实体类型与提示词：人、公司、日期、术语、产品
- [ ] **T2.3** 实现实体归一化：同名/近似名合并
- [ ] **T2.4** 在 `processDocumentForAi` 完成后触发实体提取
- [ ] **T2.5** 提取关系并写入 `KnowledgeRelation`

## 阶段三：Search API（Day 7-9）

- [ ] **T3.1** 实现 `POST /api/search`
  - 输入：自然语言 query、workspaceId、可选 dataroomIds、实体过滤
- [ ] **T3.2** 实现语义搜索：query embedding → pgvector 相似度检索
- [ ] **T3.3** 实现关键词混合搜索（可选）
- [ ] **T3.4** 搜索结果包含来源文档、页码、相关 chunk
- [ ] **T3.5** 实现按实体过滤搜索结果
- [ ] **T3.6** 为搜索 API 添加单元测试

## 阶段四：Knowledge graph API（Day 10-11）

- [ ] **T4.1** 实现 `GET /api/knowledge/entities`
  - 列出 workspace 下实体，支持按类型/名称过滤
- [ ] **T4.2** 实现 `GET /api/knowledge/entities/[id]`
  - 返回实体详情与关联关系
- [ ] **T4.3** 实现 `GET /api/knowledge/relations`
  - 列出关系，支持按实体/文档版本过滤
- [ ] **T4.4** 实现 `DELETE /api/knowledge/entities/[id]`
  - 仅 workspace 管理员可删除

## 阶段五：Frontend & backfill（Day 12-14）

- [ ] **T5.1** 前端：全局搜索页面
  - 自然语言输入、结果列表、来源引用
- [ ] **T5.2** 前端：搜索结果中展示实体标签
- [ ] **T5.3** 前端：知识图谱可视化（简单网络图）
  - 节点/关系展示、点击实体查看详情
- [ ] **T5.4** 实现历史文档异步补全实体提取 job
- [ ] **T5.5** 添加补全进度查询 API
- [ ] **T5.6** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 用户能在搜索框用自然语言查询跨 Dataroom 内容
- [ ] 搜索结果展示来源文档与页码
- [ ] 系统能自动识别文档中的人名、公司名、日期等实体
- [ ] 用户能查看实体关系图
- [ ] 新上传文档自动触发实体提取

## 风险 / 注意事项

1. **实体质量**：LLM NER 可能产生误判，需通过置信度阈值与人机反馈迭代优化。
2. **索引成本**：跨文档 embedding 检索成本高，需限流与缓存策略。
3. **隐私边界**：workspace 级隔离必须严格，organization 级共享不在 v0.5 范围内。

## 依赖

- ISSUE-004（AI Infrastructure）
- ISSUE-006（Dataroom Intelligence Layer）

## 预估工期

2 周
