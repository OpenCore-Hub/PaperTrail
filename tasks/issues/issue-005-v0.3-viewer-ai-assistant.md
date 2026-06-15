# [ISSUE-005] v0.3 Viewer AI Assistant

## 目标

在文档 viewer 内提供 AI 问答助手，答案带可点击页码引用，并能高亮原文对应位置。

## 关联 ADR

`docs/adr/001-v0.3-ai-native-dataroom-and-document-persistence.md` 第 6.3/6.4 节

## 已确认决策

- 单文档聊天使用现有 `AiConversation.scopeType = DOCUMENT`。
- 答案必须携带 citations，格式 `[{pageNumber, chunkId, excerpt}]`。
- AI Panel 默认折叠，用户可手动打开。

## 阶段一：模型与检索（Day 1-2）

- [ ] **T1.1** 新增/确认 `AiConversation` / `AiMessage` 模型
  - `scopeType = DOCUMENT`，关联 `documentId`
- [ ] **T1.2** 实现 `lib/ai/query.ts`
  - 单文档 RAG 检索 + 上下文组装
  - 返回候选 chunks 与 citation 元数据
- [ ] **T1.3** 实现 `lib/ai/citations.ts`
  - 从 LLM 输出中提取 `[{pageNumber, chunkId, excerpt}]`
  - 校验并清洗 citation 字段

## 阶段二：后端聊天 API（Day 3-4）

- [ ] **T2.1** 实现 `POST /api/documents/[id]/chat`
  - 权限校验：viewer 必须能访问该文档
  - 创建或复用 `AiConversation(scopeType=DOCUMENT)`
- [ ] **T2.2** 流式或非流式返回 Assistant 答案与 citations
- [ ] **T2.3** 历史消息持久化到 `AiMessage`

## 阶段三：前端 AI Panel（Day 5-7）

- [ ] **T3.1** 创建 `components/viewer-ai-panel.tsx`
  - 默认折叠，可手动展开
- [ ] **T3.2** 将 AI Panel 嵌入 viewer 布局
- [ ] **T3.3** 渲染 Assistant 消息并展示可点击 citations
- [ ] **T3.4** 点击 citation 跳转至 PDF 对应页码并高亮对应 chunk

## 阶段四：限流、审计、BYOK/Local（Day 8-9）

- [ ] **T4.1** 按 workspace 限流 AI 查询
- [ ] **T4.2** 所有 AI 查询写入 `lib/audit.ts`
  - 事件类型 `ai.query`
- [ ] **T4.3** 验证 BYOK / Local 模式下单文档聊天正常工作

## 阶段五：测试（Day 10-11）

- [ ] **T5.1** 单元测试：`lib/ai/query.ts` RAG 检索与 citation 提取
- [ ] **T5.2** E2E：viewer 中提问 → AI 返回答案与页码引用
- [ ] **T5.3** E2E：点击 citation 跳转并高亮对应页
- [ ] **T5.4** 运行 `npm run validate`

## 验收标准

- [ ] 用户在 viewer 中提问，AI 返回答案与页码引用
- [ ] 点击引用可跳转到 PDF 对应页
- [ ] 对话历史在同一文档内保留
- [ ] BYOK/Local 模式下单文档聊天正常工作
- [ ] AI 查询触发审计事件 `ai.query`

## 依赖

- ISSUE-004（AI Infrastructure）

## 预估工期

1.5 周
