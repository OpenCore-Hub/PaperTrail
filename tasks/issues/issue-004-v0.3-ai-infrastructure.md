# [ISSUE-004] v0.3 AI Infrastructure

## 目标

搭建完整的 AI 基础设施：pgvector 向量索引、统一的 `IAiProvider`、文档解析与 chunking pipeline、BYOK/Local 隐私模式，为 viewer AI 助手和数据室智能体提供底座。

## 关联 ADR

`docs/adr/001-v0.3-ai-native-dataroom-and-document-persistence.md` 第 6 节

## 已确认决策

- 向量存储：PostgreSQL `pgvector`
- Embedding 默认：`text-embedding-3-small`
- PDF 解析：`pdf-parse`（v0.4 评估 `mupdf`）
- Chunk 元数据：必须含 `pageNumber`、`paragraphIndex`
- 隐私模式：Cloud / BYOK / Local

## 阶段一：数据库与模型（Day 1-2）

- [ ] **T1.1** 在 migration 中启用 `pgvector`
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] **T1.2** 新增 Prisma 模型：
  - `DocumentChunk`（embedding 用 `Unsupported("vector(1536)")`，含 `pageNumber`、`paragraphIndex`、`metadata`）
  - `AiProviderConfig`
  - `AiProviderMode` enum
- [ ] **T1.3** 手动创建 HNSW 索引（Prisma 不支持）
  ```sql
  CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
  ```
- [ ] **T1.4** 生成 migration 并验证 `prisma generate`

## 阶段二：AI Provider 抽象（Day 3-5）

- [ ] **T2.1** 创建 `lib/ai/providers/types.ts`
  - `IAiProvider` 接口：`complete()`、`embed()`
- [ ] **T2.2** 实现 `OpenAiProvider`
  - 支持 chat completion 与 embedding
- [ ] **T2.3** 实现 `AnthropicProvider`
  - 仅支持 completion，embedding 回退到 OpenAI 或报错
- [ ] **T2.4** 实现 `OllamaProvider`
  - 调用本地 `/v1/chat/completions` 与 `/v1/embeddings` 兼容端点
- [ ] **T2.5** 创建 `lib/ai/providers/factory.ts`
  - 根据 `AiProviderConfig` 返回对应 provider
- [ ] **T2.6** 预留 `POST /api/ai/extract` 结构化提取端点
  - v0.3 返回 501 Not Implemented 或简单骨架
  - 为 v0.4 AI Suggestion 做准备

## 阶段三：文档解析与 Chunking（Day 6-8）

- [ ] **T3.1** 创建 `lib/ai/jobs/process-document-for-ai.ts`
  - 下载文件 → 提取文本 → chunk → embed → 写入 `DocumentChunk`
- [ ] **T3.2** 实现 `lib/ai/parsers/pdf-parser.ts`
  - 使用 `pdf-parse` 提取每页文本
- [ ] **T3.3** 实现 `lib/ai/chunking/index.ts`
  - 默认按页切分
  - 单页 > 1500 tokens 时按段落二次切分，保留 200 tokens overlap
- [ ] **T3.4** 实现 `lib/ai/jobs/queue.ts`
  - 使用 Redis + 内存 fallback 的轻量队列
- [ ] **T3.5** 在上传/版本更新后 enqueue `processDocumentForAi`

## 阶段四：Workspace AI 设置与 BYOK（Day 9-10）

- [ ] **T4.1** 创建 `app/api/workspaces/ai-config/route.ts`
  - GET / PUT AI 配置
- [ ] **T4.2** 实现 BYOK apiKey 加密
  - 使用 `NEXTAUTH_SECRET` 派生密钥，AES-256-GCM
- [ ] **T4.3** 前端：`app/dashboard/settings/ai/page.tsx`
  - Cloud / BYOK / Local 三档选择
- [ ] **T4.4** 验证 Local 模式能指向 Ollama
- [ ] **T4.5** 明确 Local 模式 embedding 策略
  - 默认要求用户提供兼容 `/v1/embeddings` 的端点
  - 在 AI 设置页给出端点配置项与校验

## 阶段五：测试与验证（Day 11-14）

- [ ] **T5.1** 单元测试：chunking 算法
- [ ] **T5.2** 单元测试：provider factory
- [ ] **T5.3** 集成测试：上传 PDF → chunk → embedding → 相似度搜索
- [ ] **T5.4** 验证 BYOK 模式下请求使用用户 key
- [ ] **T5.5** 验证解析失败时 `aiStatus = FAILED`，viewer 不受影响
- [ ] **T5.6** PDF 解析库选型 spike
  - 对比 `pdf-parse` 与 `mupdf` 的准确率、性能、部署成本
  - 输出选型报告，决定是否 v0.4 升级

## 验收标准

- [ ] `SELECT embedding <-> query_vec FROM document_chunks` 能返回相关结果
- [ ] BYOK 配置后，AI 请求使用用户提供的 key
- [ ] Local 配置后，AI 请求指向 `baseUrl`
- [ ] 上传 PDF 后自动后台索引，无阻塞
- [ ] `npm run validate` 通过

## 风险 / 注意事项

1. **pgvector 扩展**：生产 PostgreSQL 需预装 pgvector；Docker Compose 需确认镜像。
2. **Embedding 维度**：OpenAI `text-embedding-3-small` 是 1536 维；若换模型需同步 schema。
3. **PDF 解析失败**：`pdf-parse` 对部分扫描件/加密 PDF 会失败，需优雅降级。

## 依赖

- ISSUE-001（DocumentVersion 模型）

## 预估工期

2 周
