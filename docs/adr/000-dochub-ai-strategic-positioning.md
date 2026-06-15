# ADR-000: DocHub AI Strategic Positioning — Document Intelligence Layer

## 元数据

- **状态**: Proposed
- **作者**: Zed Agent
- **日期**: 2026-06-15
- **关联 ADR**: `001-v0.3-ai-native-dataroom-and-document-persistence.md`, `002-v0.4-dataroom-intelligence-layer-and-growth-stack.md`, `003-v0.5-autonomous-document-intelligence-platform.md`
- **关联分析**: GitNexus 双库扫描（PaperTrail 1,448 symbols / papermark 18,761 symbols）

## 1. 核心论断

**AI 不是 DocHub 的一个功能开关，而是贯穿文档、链接、数据室、工作流的「Document Intelligence Layer」。**

Papermark 把 AI 放在 `ee/features/ai/`，作为企业版附加组件，能力是「单文档聊天」。DocHub 的战略机会是：**从 v0.3 起就让 AI 成为原生能力，且面向数据室级（dataroom-level）智能体演进。**

## 2. 三大 AI-Native 场景

| 场景 | 传统做法 | AI-Native 做法 | DocHub 优势 |
|---|---|---|---|
| **文档理解** | 人工阅读、手动填字段 | 自动摘要、条款提取、风险标亮、生成尽职调查清单 | 解析结果直接驱动工作流与权限 |
| **链接治理** | 人工设置密码/水印/NDA | AI 根据文档内容推荐访问级别、水印文案、NFA/NDA 模板 | 从「手动配置」到「策略推荐」 |
| **数据室协作** | 文件夹 + 权限组 | 跨文档问答、对比多份文件、自动生成投资者 FAQ、智能权限审计 | Papermark 没有数据室级智能体 |

## 3. 与 Papermark 的 AI 差异化

| 维度 | Papermark | DocHub |
|---|---|---|
| 定位 | 企业版附加插件 | 原生核心能力 |
| 范围 | 单文档 Q&A | 单文档 → 数据室 → 工作流 |
| 架构 | Trigger.dev + 外部 Vector Store | PostgreSQL pgvector + 自托管队列 |
| 隐私 | 默认平台模型 | Cloud / BYOK / Local 三档 |
| 引用 | 答案无页码定位 | 强制页码/段落高亮 |
| 自动化 | 仅聊天 | 解析结果驱动策略与动作 |

## 4. 技术架构原则

### 4.1 隐私优先

- **Cloud**：平台托管模型，按用量计费。
- **BYOK**：用户自带 OpenAI/Anthropic API Key，平台不触碰模型流量。
- **Local**：Ollama / vLLM / 兼容 OpenAI 的本地端点，数据不出服务器。

### 4.2 自托管友好

- 向量存储使用 PostgreSQL `pgvector`，不引入 Pinecone/Weaviate。
- 文档解析 pipeline 自包含，不依赖 Papermark 的 Trigger.dev 重型链路。
- 模型路由统一抽象，便于替换与本地部署。

### 4.3 引用可验证

- 每个 chunk 强制保留 `pageNumber`、`paragraphIndex`、`boundingBox`。
- AI 答案必须携带 `citations`，前端可反查并高亮原文。

### 4.4 智能驱动策略

- AI 解析结果写入 `DocumentVersion.aiMetadata`。
- 链接治理、权限、标签、工作流均可读取该元数据做推荐或自动决策。

## 5. 三版本 AI 演进路线

| 版本 | AI 主题 | 核心能力 | 非 AI 支撑 |
|---|---|---|---|
| **v0.3** | AI 基础 + Dataroom | 单文档 viewer Q&A + 引用高亮；BYOK/Local；文档解析 pipeline；AI 推荐链接策略 | Dataroom 基础；企业级链接治理；文档版本 |
| **v0.4** | 数据室智能体 | 跨文档问答；文档对比；自动生成 FAQ；AI-Augmented Workflows；AI 推荐 viewer group / 权限 | Stripe 计费；Viewer Groups；Integrations；高级分析 |
| **v0.5** | 自主文档智能平台 | AI Agents 自主执行（DealRoom/Compliance/Sales/DocOps）；跨数据室联邦搜索；知识图谱 | Organization/SSO；实时协作；插件系统 |

## 6. 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 向量存储 | PostgreSQL pgvector | 自托管无新增依赖 |
| Embedding | OpenAI `text-embedding-3-small` 默认，可换 local | 够用且轻量 |
| 模型路由 | 统一 `IAiProvider` 接口 | 支持 OpenAI/Anthropic/Ollama |
| 文档解析 | PDF 用 `pdf-parse`/`mupdf`，Excel 用 `exceljs`，视频预留 | 避免重型依赖 |
| 引用机制 | Chunk 元数据强制记录页码/段落 | 可验证、可高亮 |
| 隐私模式 | Cloud / BYOK / Local 三档 | 覆盖所有合规场景 |

## 7. 成功指标

- **AI 采用率**：多少 viewer 会话使用了 AI 问答。
- **策略采纳率**：AI 推荐的链接策略/标签/权限被用户采纳的比例。
- **BYOK/Local 比例**：企业客户中选择私有化部署的比例。
- **跨文档查询占比**：v0.4 后 Dataroom 级查询占 AI 查询的比例。
- **Agent 自动化率**：v0.5 后 AI Agent 自主完成、无需人工审批的操作比例。

## 8. 与三份 ADR 的对应关系

- **ADR-001（v0.3）**：奠定 AI 基础设施（`IAiProvider`、`DocumentChunk`、pgvector、BYOK）和单文档智能。
- **ADR-002（v0.4）**：把智能从单文档扩展到数据室，形成「数据室智能体」，并叠加商业化能力。
- **ADR-003（v0.5）**：让智能体具备自主性，形成平台级护城河。

## 9. 未解决的战略问题

1. **Embedding 模型**：v0.3 默认 OpenAI，Local 模式是否要求用户自备 embedding 端点？
2. **PDF 解析库**：`pdf-parse` 维护停滞，是否应在 v0.4 升级到 `mupdf`？
3. **水印安全与 AI 的矛盾**：前端 Canvas 水印 vs 后端 PDF 重绘，如何平衡体验与安全？
4. **Agent 权限边界**：v0.5 AI Agent 可操作到何种程度？哪些动作必须人工审批？
5. **知识图谱所有权**：workspace 级还是 organization 级？多 workspace 是否共享实体？
