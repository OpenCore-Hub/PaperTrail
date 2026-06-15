# [ISSUE-007] v0.4 Billing & Plans

## 目标

接入 Stripe 实现订阅计费，按 plan 限制功能与用量，让 DocHub 具备商业化能力。

## 关联 ADR

`docs/adr/002-v0.4-dataroom-intelligence-layer-and-growth-stack.md` 第 4 节

## 已确认决策

- 仅 USD，多币种推迟。
- 计划：Free / Starter / Pro / Enterprise。
- AI 能力是核心计费差异化卖点。
- 现有 workspace 默认迁移到 Free plan。

## 阶段一：Schema & Stripe 接入准备（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型：
  - `BillingCustomer`（关联 workspace 与 Stripe customerId）
  - `Subscription`（status / plan / currentPeriodEnd / cancelAtPeriodEnd）
  - `Invoice`（stripeInvoiceId / amount / status / pdfUrl）
  - `WorkspaceLimit`（`limits` JSON：documents / datarooms / aiQueries / versions / customDomain / workflows 等）
- [ ] **T1.2** 安装 Stripe SDK，配置 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` 环境变量
- [ ] **T1.3** 创建 `lib/stripe/client.ts`，初始化 `Stripe` 实例
- [ ] **T1.4** 为现有 workspace 写 migration：全部默认迁移到 Free plan

## 阶段二：Stripe 集成 API（Day 4-6）

- [ ] **T2.1** 实现 `POST /api/billing/checkout`
  - 创建 Stripe Checkout Session，返回 `clientSecret`
- [ ] **T2.2** 实现 `POST /api/billing/portal`
  - 创建 Stripe Customer Portal session
- [ ] **T2.3** 实现 `POST /api/webhooks/stripe`
  - 验证 webhook signature
  - 处理 `checkout.session.completed`、`invoice.paid`、`customer.subscription.updated/deleted`
- [ ] **T2.4** 在 webhook handler 中同步 `Subscription`、`Invoice`、`WorkspaceLimit`
- [ ] **T2.5** 实现 `GET /api/billing/subscription`
  - 返回当前 workspace 订阅状态
- [ ] **T2.6** 实现 `GET /api/workspaces/limits`
  - 返回当前 plan 限制与已用用量

## 阶段三：Feature Gates & 用量限制（Day 7-9）

- [ ] **T3.1** 实现 `lib/billing/plans.ts`
  - 定义各 plan 的功能矩阵与用量上限
- [ ] **T3.2** 实现 `lib/billing/guards.ts`
  - `requireFeature(workspaceId, Feature)`
  - `requirePlan(workspaceId, Plan)`
- [ ] **T3.3** 实现 `lib/billing/usage.ts`
  - 记录并检查 AI chat 次数、workflow 执行次数、API 调用次数等
  - 接近上限时返回 warn，达到上限时拒绝
- [ ] **T3.4** 在 Dataroom Intelligence、Workflow、API Key 等入口后端加入 gate 校验
- [ ] **T3.5** 计费/订阅/用量变更写入 `lib/audit.ts`

## 阶段四：Frontend 计费页面（Day 10-12）

- [ ] **T4.1** 前端：Plan 升级页面
  - 展示 Free / Starter / Pro / Enterprise 对比
  - 调用 Stripe Checkout
- [ ] **T4.2** 前端：订阅管理页面
  - 显示当前 plan、用量、发票列表
  - 提供 Customer Portal 入口
- [ ] **T4.3** 在 Dataroom Intelligence、Workflow、API Key 等入口加入 plan gate UI
  - 未授权时展示升级提示与 CTA
- [ ] **T4.4** 用量接近/达到上限时展示升级提示组件

## 阶段五：测试与 Webhook 验证（Day 13-14）

- [ ] **T5.1** 单元测试：feature guards / usage limit 逻辑
- [ ] **T5.2** 集成测试：Stripe webhook payload 处理
- [ ] **T5.3** 集成测试：Checkout → 支付成功 → subscription 升级
- [ ] **T5.4** 手动验证订阅取消/到期后自动降级为 Free
- [ ] **T5.5** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 用户能完成 Stripe 订阅支付
- [ ] webhook 能正确更新 Subscription 与 WorkspaceLimit
- [ ] Free 用户无法使用 Dataroom Intelligence 等 Pro 功能
- [ ] 用量达到限制后给出升级提示
- [ ] 订阅取消/到期后自动降级

## 风险 / 注意事项

1. **Webhook 签名验证**：务必使用 `STRIPE_WEBHOOK_SECRET`，本地测试用 Stripe CLI 转发。
2. **Plan 枚举变更**：新增 plan 时需要同步 `plans.ts` 矩阵、Prisma enum 与前端文案。
3. **用量计数一致性**：并发场景下需使用数据库原子操作或队列，避免超用。

## 依赖

- 无（可独立开发，测试需 Stripe test key）

## 预估工期

2 周
