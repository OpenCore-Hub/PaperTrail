# [ISSUE-006] v0.4 Dataroom Intelligence Layer

## 目标

把 AI 从单文档助手升级为数据室级智能体，实现跨文档问答、文档对比、自动生成投资者 FAQ、AI 推荐链接策略与权限。

## 关联 ADR

`docs/adr/002-v0.4-dataroom-intelligence-layer-and-growth-stack.md` 第 3 节

## 已确认决策

- 检索范围：Dataroom 内所有文档的最新版本 chunk
- 答案必须带引用：来源文档 + 页码
- Auto-FAQ 生成后需人工审核
- AI Suggestion 30 天未采纳自动过期

## 阶段一：跨文档问答（Day 1-6）

- [ ] **T1.1** 创建 `lib/ai/dataroom-chat.ts`
  - `retrieveDataroomChunks(dataroomId, question, filters)`
  - 支持按 `documentIds` 过滤
- [ ] **T1.2** 实现 `POST /api/datarooms/[id]/chat`
  - 权限校验：viewer 必须能访问该 dataroom
  - 创建/复用 `AiConversation(scopeType=DATAROOM)`
- [ ] **T1.3** 前端：Dataroom viewer AI Panel
  - 可折叠侧边栏
  - 消息展示引用
- [ ] **T1.4** 前端：点击引用跳转并高亮对应页
- [ ] **T1.5** 限流：按 workspace 统计 dataroom chat 次数

## 阶段二：文档对比（Day 7-10）

- [ ] **T2.1** 实现 `POST /api/documents/[id]/compare`
  - 输入：`baseVersionId`、`targetVersionId`
  - 输出：差异段落、关键数字变化、风险标亮
- [ ] **T2.2** 设计 prompt：让 LLM 以结构化 JSON 返回对比结果
- [ ] **T2.3** 前端：文档对比结果页
  - side-by-side 展示
  - 新增/删除/修改高亮
- [ ] **T2.4** 设置文档对比安全限制
  - 单份对比最大页数（例如 200 页）或最大 token 数
  - 超限返回友好提示，建议分段对比

## 阶段三：Auto-FAQ（Day 11-14）

- [ ] **T3.1** 新增 `DataroomFaqItem` 模型
  - 字段含 `sourceChunkIds`，记录答案来源 chunk
- [ ] **T3.2** 实现 FAQ 生成 job
  - 扫描 dataroom chunks，生成 Q&A
- [ ] **T3.3** 实现 `/api/datarooms/[id]/faq`（生成 + 列表）
- [ ] **T3.4** 实现 FAQ 审核 API：approve / hide / edit
- [ ] **T3.5** 前端：Dataroom 欢迎页展示已审核 FAQ
- [ ] **T3.6** 前端：FAQ 管理后台
- [ ] **T3.7** 确定 FAQ 生成触发策略
  - 默认：Dataroom 内任一文档完成 AI 索引后自动触发（去重）
  - 提供手动触发入口 `/api/datarooms/[id]/faq/generate`

## 阶段四：AI 推荐策略（Day 15-18）

- [ ] **T4.1** 新增 `AiSuggestion` 模型
- [ ] **T4.2** 在 `processDocumentForAi` 后触发策略分析
  - 输出：watermark / NDA / viewerGroup / tag / permission 建议
- [ ] **T4.3** 实现 `/api/ai/suggestions` 与 `/api/ai/suggestions/[id]/apply`
- [ ] **T4.4** 前端：LinkSheet / Dataroom 设置中展示 AI 推荐
- [ ] **T4.5** 实现 30 天未采纳自动清理

## 阶段五：计费门控与测试（Day 19-21）

- [ ] **T5.1** 添加 `Feature.DATAROOM_INTELLIGENCE` gate
- [ ] **T5.2** 单元测试：跨文档检索
- [ ] **T5.3** E2E：Dataroom chat → 验证引用
- [ ] **T5.4** E2E：文档对比 → 验证差异报告

## 验收标准

- [ ] Dataroom viewer 中提问，AI 综合多文档回答并引用来源文档和页码
- [ ] 两份版本对比能展示条款差异与关键数字变化
- [ ] AI 生成的 FAQ 经审核后展示在 Dataroom 欢迎页
- [ ] AI 推荐策略（水印/NDA/分组）可一键采纳
- [ ] Free 计划无法使用 Dataroom 级智能

## 风险 / 注意事项

1. **Token 成本**：跨文档问答和文档对比消耗大量 token，需限流与成本控制。
2. **隐私隔离**：严格按 workspace 隔离 chunk 检索，防止跨 workspace 数据泄露。
3. **并发写入**：多个文档同时更新时，FAQ 生成 job 可能重复，需去重。

## 依赖

- ISSUE-002（Dataroom Foundation）
- ISSUE-004（AI Infrastructure）
- ISSUE-005（Viewer AI Assistant）
- ISSUE-007（Billing & Plans，用于 feature gate）

## 预估工期

3 周
