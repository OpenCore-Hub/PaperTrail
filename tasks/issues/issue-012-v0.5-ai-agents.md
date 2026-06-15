# [ISSUE-012] v0.5 AI Agents

## 目标

让 AI 从被动回答进化为主动执行：实现 DealRoom、Compliance、Sales、DocOps 四类 AI Agent，支持审批队列。

## 关联 ADR

`docs/adr/003-v0.5-autonomous-document-intelligence-platform.md` 第 5 节

## 已确认决策

- Agent 基于 v0.4 的 Dataroom Intelligence Layer。
- 高影响动作（删除、权限变更、外发）必须人工审批。
- Agent 运行记录包含触发事件、LLM 决策、执行结果。

## 阶段一：Schema & agent router（Day 1-4）

- [ ] **T1.1** 新增 Prisma 模型 `AiAgent`
  - 字段：`id`、`workspaceId`、`type`、`name`、`config`、`enabled`、`createdAt`、`updatedAt`
- [ ] **T1.2** 新增 Prisma 模型 `AiAgentRun`
  - 字段：`id`、`agentId`、`triggerEvent`、`llmDecision`、`status`、`output`、`createdAt`、`completedAt`
- [ ] **T1.3** 定义 Agent 类型枚举：`DEAL_ROOM`、`COMPLIANCE`、`SALES`、`DOC_OPS`
- [ ] **T1.4** 实现 Agent Router：`lib/ai/agents/router.ts`
  - 接收 trigger → 匹配 agent → LLM 决策 → 执行/创建审批
- [ ] **T1.5** 实现 Agent 配置 API：`/api/workspaces/[id]/agents`

## 阶段二：DealRoomAgent & SalesAgent（Day 5-9）

- [ ] **T2.1** 实现 `DealRoomAgent`
  - 高意向访问提醒、访问摘要生成、FAQ 补充建议
- [ ] **T2.2** 在 dataroom 访问事件中触发 DealRoomAgent
- [ ] **T2.3** 实现 `SalesAgent`
  - 买家参与度追踪、下一步行动推荐
- [ ] **T2.4** 在 viewer 访问日志中聚合 buyer 行为信号
- [ ] **T2.5** 将 SalesAgent 推荐写入 `AiAgentRun` 与通知
- [ ] **T2.6** 为两个 agent 添加单元测试

## 阶段三：ComplianceAgent & DocOpsAgent（Day 10-13）

- [ ] **T3.1** 实现 `ComplianceAgent`
  - NDA 检查、敏感条款标亮、异常访问审计
- [ ] **T3.2** 在访问请求阶段调用 ComplianceAgent 拦截未签 NDA
- [ ] **T3.3** 实现 `DocOpsAgent`
  - 过期文档归档、重复版本清理建议
- [ ] **T3.4** 在 document version 变更/到期时触发 DocOpsAgent
- [ ] **T3.5** 为高影响动作标记 `requiresApproval = true`
- [ ] **T3.6** 为两个 agent 添加单元测试

## 阶段四：Approval queue（Day 14-16）

- [ ] **T4.1** 新增 Prisma 模型 `AgentApproval`
  - 字段：`id`、`agentRunId`、`requesterId`、`actionType`、`payload`、`status`、`reviewerId`、`comment`、`createdAt`、`resolvedAt`
- [ ] **T4.2** 实现审批队列 API：`/api/agent-approvals`
  - list / approve / reject
- [ ] **T4.3** 实现 agent 执行器：审批通过后执行实际动作
- [ ] **T4.4** 所有 agent 操作写入审计日志
- [ ] **T4.5** 通知用户有新的审批待处理

## 阶段五：Frontend & config（Day 17-19）

- [ ] **T5.1** 前端：Agent 配置页面
  - 启用/禁用、配置参数
- [ ] **T5.2** 前端：Agent 运行历史页
- [ ] **T5.3** 前端：审批队列 UI
- [ ] **T5.4** 前端：Dataroom 设置中展示 Agent 推荐
- [ ] **T5.5** 在相关页面展示 Agent 运行状态 badge

## 阶段六：Tests & audit（Day 20-21）

- [ ] **T6.1** 单元测试：Agent Router 决策逻辑
- [ ] **T6.2** 集成测试：DealRoomAgent 触发 → 生成摘要
- [ ] **T6.3** 集成测试：高影响动作 → 进入审批队列 → 批准后执行
- [ ] **T6.4** E2E：启用 ComplianceAgent → 未签 NDA 访问被拦截
- [ ] **T6.5** 运行完整验证：`npm run validate`

## 验收标准

- [ ] DealRoomAgent 能在高意向访问时主动通知
- [ ] ComplianceAgent 能识别未签署 NDA 的访问并阻止
- [ ] SalesAgent 能根据多次查看行为推荐 follow-up
- [ ] DocOpsAgent 能按策略归档旧版本
- [ ] 高影响动作进入审批队列，审批后才执行

## 风险 / 注意事项

1. **LLM 决策不可控**：必须将高影响动作限定在审批范围内，避免自动执行危险操作。
2. **Token 成本**：Agent 频繁触发会增加 AI 调用成本，需配置触发频率与限流。
3. **审计合规**：所有 Agent 运行记录需长期保留，满足企业审计需求。

## 依赖

- ISSUE-006（Dataroom Intelligence Layer）
- ISSUE-008（Workflows，Agent 可复用动作执行机制）

## 预估工期

3 周
