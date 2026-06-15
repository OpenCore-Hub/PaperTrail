# [ISSUE-008] v0.4 AI-Augmented Workflows

## 目标

实现触发器-动作工作流引擎，并用 AI 增强：AI 建议模板、自然语言创建工作流、LLM 条件判断。

## 关联 ADR

`docs/adr/002-v0.4-dataroom-intelligence-layer-and-growth-stack.md` 第 5 节

## 已确认决策

- 工作流基于 Redis Streams 异步执行。
- 触发器：文档查看/下载、链接创建、Dataroom 访问、NDA 签署、AI 提问等。
- 动作：发邮件、Slack、Webhook、移动文件、更新标签等。
- Free 计划不开放工作流。

## 阶段一：Schema & Event Bus（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型：
  - `Workflow`（触发器、状态、所属 workspace）
  - `WorkflowStep`（顺序、类型、配置）
  - `WorkflowExecution`（状态、输入、输出、错误信息）
- [ ] **T1.2** 创建 `lib/workflows/types.ts`
  - 定义 `TriggerEvent`、`ActionType`、`IWorkflowStep`、`WorkflowContext`
- [ ] **T1.3** 创建 `lib/events/publisher.ts`
  - 将文档查看/下载、链接创建、Dataroom 访问、NDA 签署、AI 提问等事件发布到 Redis Streams
- [ ] **T1.4** 创建 `lib/events/consumer.ts`
  - Redis Streams 消费者组，订阅 workflow 事件

## 阶段二：Workflow Engine Core（Day 4-6）

- [ ] **T2.1** 实现 `lib/workflows/engine.ts`
  - 根据 trigger 查询匹配的 Workflow
  - 顺序执行 WorkflowStep
- [ ] **T2.2** 实现 `WorkflowExecution` 状态机
  - `PENDING` / `RUNNING` / `COMPLETED` / `FAILED` / `RETRYING`
- [ ] **T2.3** 实现模板变量替换
  - `{{document.filename}}`、`{{link.url}}`、`{{viewer.email}}` 等
- [ ] **T2.4** 实现错误捕获与重试策略
  - 指数退避，最大重试次数可配置
- [ ] **T2.5** 实现重试/取消/重新执行 API
- [ ] **T2.6** 实现 `GET /api/workflows/[id]/executions`

## 阶段三：Step Types & Actions（Day 7-9）

- [ ] **T3.1** 实现 `SEND_EMAIL` action
  - 调用邮件服务，支持模板变量
- [ ] **T3.2** 实现 `SEND_SLACK_MESSAGE` action
  - 复用 ISSUE-009 Slack integration
- [ ] **T3.3** 实现 `CALL_WEBHOOK` action
  - POST JSON，支持 HMAC 签名
- [ ] **T3.4** 实现 `CREATE_TASK` / `MOVE_TO_FOLDER` / `UPDATE_TAG` / `NOTIFY_OWNER` actions
  - 与 ADR-002 定义的动作类型保持一致
- [ ] **T3.5** 实现 `WAIT` 与 `CONDITION`（基础条件）step type
- [ ] **T3.6** 实现 Workflow 执行沙箱
  - 网络请求超时 10s、重试 3 次、禁止访问内网

## 阶段四：AI 增强功能（Day 10-11）

- [ ] **T4.1** 实现 `AI_CONDITION` step type
  - 用 LLM 判断条件是否成立，返回 JSON 决策
- [ ] **T4.2** 实现 AI 建议工作流模板
  - 根据文档类型/dataroom 用途推荐模板
  - `POST /api/workflows/suggestions`
- [ ] **T4.3** 实现自然语言创建工作流
  - `POST /api/workflows/generate`
  - LLM 输出 Workflow + Steps 结构，经用户确认后保存
- [ ] **T4.4** 对 AI 生成结果做 schema 校验与错误回退

## 阶段五：Frontend & Tests（Day 12-14）

- [ ] **T5.1** 前端：Workflow 编辑器
  - 触发器选择、step 拖拽/添加/配置
- [ ] **T5.2** 前端：Workflow 执行历史
  - 列表、状态、错误详情、手动重试
- [ ] **T5.3** 前端：AI 模板推荐与自然语言创建入口
- [ ] **T5.4** 单元测试：engine、变量替换、状态机
- [ ] **T5.5** 集成测试：事件触发 → workflow 执行 → Slack/邮件/Webhook 动作
- [ ] **T5.6** 运行完整验证：`npm run validate`
- [ ] **T5.7** Workflow 执行与触发事件写入 `lib/audit.ts`

## 验收标准

- [ ] 用户能创建基于事件触发的工作流
- [ ] 文档被查看时自动触发邮件/Slack 通知
- [ ] AI 能根据文档类型建议合适的工作流模板
- [ ] 用户能用自然语言描述生成工作流
- [ ] 执行失败时记录错误并可重试

## 风险 / 注意事项

1. **事件顺序**：Redis Streams 消费者需保证至少一次投递，避免重复执行影响动作幂等性。
2. **循环触发**：Workflow 动作可能再次产生事件，需设计防止无限循环机制。
3. **Free plan 限制**：所有工作流入口必须前后端同时校验 plan gate。

## 依赖

- ISSUE-004（AI Infrastructure）
- ISSUE-009（Integrations 中的 Slack/Webhook）

## 预估工期

2 周
