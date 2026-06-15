# [ISSUE-009] v0.4 Integrations & Public API

## 目标

建立集成生态：Slack、Notion、出站 Webhook，并提供 API Key 认证的公共 API。

## 关联 ADR

`docs/adr/002-v0.4-dataroom-intelligence-layer-and-growth-stack.md` 第 7 节

## 已确认决策

- 集成 token AES-256-GCM 加密。
- API Key 使用 SHA-256 hash + prefix 显示。
- 公共 API 路径前缀 `/api/v1`。

## 阶段一：Schema & 类型抽象（Day 1-2）

- [ ] **T1.1** 新增 Prisma 模型：
  - `Integration`（type / status / encryptedToken / workspaceId）
  - `ApiKey`（name / prefix / hashedKey / scopes / lastUsedAt）
- [ ] **T1.2** 定义 `lib/integrations/types.ts`
  - `IIntegration` 接口：`connect`、`disconnect`、`sendMessage`、`importPage` 等
  - `IntegrationType` enum：SLACK / NOTION / WEBHOOK
- [ ] **T1.3** 创建 `lib/integrations/factory.ts`
  - 根据 `IntegrationType` 返回对应 handler
- [ ] **T1.4** 实现加密工具 `lib/integrations/crypto.ts`
  - AES-256-GCM 加解密集成 token

## 阶段二：Slack Integration（Day 3-5）

- [ ] **T2.1** 实现 Slack OAuth 安装流程
  - `GET /api/integrations/slack/install`
  - `GET /api/integrations/slack/callback`
- [ ] **T2.2** 实现 Slack 消息发送 handler
  - `lib/integrations/slack/send-message.ts`
- [ ] **T2.3** 在工作流/事件触发中复用 Slack handler
- [ ] **T2.4** 存储 Slack workspace / channel 元数据到 `Integration` 表
- [ ] **T2.5** 手动验证：文档查看事件通知到 Slack 频道

## 阶段三：Notion Integration（Day 6-8）

- [ ] **T3.1** 实现 Notion OAuth 安装流程
  - `GET /api/integrations/notion/install`
  - `GET /api/integrations/notion/callback`
- [ ] **T3.2** 实现 Notion 页面导入 handler
  - 将页面内容导出为 PDF 或 Dataroom 索引
- [ ] **T3.3** 实现 Notion 数据库导出 handler
  - 将 Dataroom 文档列表同步到 Notion 数据库
- [ ] **T3.4** 持久化 Notion access token 与 page/database id
- [ ] **T3.5** 手动验证：Notion 页面导入为 Dataroom 索引

## 阶段四：Webhook & API Key（Day 9-11）

- [ ] **T4.1** 实现出站 Webhook handler
  - `lib/integrations/webhook/outgoing.ts`
  - 支持 HMAC-SHA256 签名与重试
- [ ] **T4.2** 实现 `POST /api/webhooks/outgoing/test`
  - 测试 webhook 配置
- [ ] **T4.3** 实现 API Key 创建/删除/列表 API
  - `POST /api/api-keys`
  - `DELETE /api/api-keys/[id]`
  - `GET /api/api-keys`
- [ ] **T4.4** 实现 API Key 认证 middleware
  - SHA-256 hash 校验，解析 scopes
- [ ] **T4.5** API Key 创建后只完整显示一次，后续仅展示 prefix

## 阶段五：公共 API 与 Frontend（Day 12-14）

- [ ] **T5.1** 挂载 `/api/v1` 路由与 API Key 认证 middleware
- [ ] **T5.2** 实现 `/api/v1/documents` 端点
  - 列出、上传、删除文档
- [ ] **T5.3** 实现 `/api/v1/links` 端点
  - 创建/更新/列出 share link
- [ ] **T5.4** 实现 `/api/v1/datarooms` 与 `/api/v1/analytics` 端点
- [ ] **T5.5** 前端：Integrations 设置页
  - Slack / Notion / Webhook 连接与配置
- [ ] **T5.6** 前端：API Keys 管理页
  - 创建、显示一次性完整 key、删除
- [ ] **T5.7** 运行完整验证：`npm run validate`
- [ ] **T5.8** 集成连接 / API Key 使用 / Webhook 触发写入 `lib/audit.ts`

## 验收标准

- [ ] Slack 连接后，文档查看事件能通知到频道
- [ ] Notion 页面能导入为 PDF 或 Dataroom 索引
- [ ] 出站 Webhook 能被触发并收到带签名的 POST
- [ ] 使用 API Key 能调用 `/api/v1/documents`
- [ ] API Key 创建后只完整显示一次

## 风险 / 注意事项

1. **Token 安全**：所有第三方 access token 必须加密存储，禁止明文落库。
2. **OAuth 回调安全**：校验 `state` 参数防止 CSRF。
3. **公共 API 版本控制**：`/api/v1` 作为稳定契约，后续 breaking change 需走 v2。

## 依赖

- ISSUE-002（Dataroom）
- ISSUE-003（ShareLink）

## 预估工期

2 周
