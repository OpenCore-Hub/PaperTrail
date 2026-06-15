# [ISSUE-011] v0.5 Organizations & SSO

## 目标

支持多 Workspace 组织、SAML/OIDC SSO、数据驻留与合规策略，让 DocHub 满足大型企业需求。

## 关联 ADR

`docs/adr/003-v0.5-autonomous-document-intelligence-platform.md` 第 3、4 节

## 已确认决策

- 采用 `@boxyhq/saml-jackson` 实现 SAML。
- Organization 可包含多个 Workspace；现有单 Workspace 用户 organizationId 为 null。
- 数据驻留 region：eu / us / apac。

## 阶段一：Schema & models（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型 `Organization`
  - 字段：`id`、`name`、`slug`、`ownerId`、`region`、`createdAt`、`updatedAt`
- [ ] **T1.2** 新增 Prisma 模型 `OrganizationMembership`
  - 字段：`userId`、`organizationId`、`role`（owner/admin/member）、`joinedAt`
- [ ] **T1.3** 新增 Prisma 模型 `SamlConnection`
  - 字段：`id`、`organizationId`、`metadataUrl`、`issuer`、`entryPoint`、`cert`、`createdAt`
- [ ] **T1.4** 新增 Prisma 模型 `SecuritySettings`
  - 字段：`organizationId`、`enforceSso`、`allowedDomains`、`auditRetentionDays`、`requireMfa`
- [ ] **T1.5** 为 `Workspace` 新增 `organizationId`（nullable）
- [ ] **T1.6** 生成 migration：`npx prisma migrate dev --name organizations`

## 阶段二：Organization API & membership（Day 4-7）

- [ ] **T2.1** 实现 `POST /api/organizations`
  - 创建 organization 并设置当前用户为 owner
- [ ] **T2.2** 实现 `GET /api/organizations`、`GET /api/organizations/[id]`
  - 权限：成员可见
- [ ] **T2.3** 实现 `PUT /api/organizations/[id]` 与 `DELETE /api/organizations/[id]`
  - 权限：owner/admin
- [ ] **T2.4** 实现成员管理 API：`/api/organizations/[id]/members`
  - invite / remove / update role
- [ ] **T2.5** 实现 organization 下 Workspace 列表与归属迁移
- [ ] **T2.6** 更新现有用户可选创建个人 Organization 的引导

## 阶段三：SAML SSO（Day 8-13）

- [ ] **T3.1** 初始化 `@boxyhq/saml-jackson` 配置
- [ ] **T3.2** 实现 SAML 元数据配置 API：`/api/organizations/[id]/saml`
- [ ] **T3.3** 实现 SAML SP-initiated 登录入口：`/api/auth/saml`
- [ ] **T3.4** 实现 SAML ACS callback 处理
- [ ] **T3.5** 将 SAML 用户映射到现有用户或创建新用户
- [ ] **T3.6** 在登录流程中优先使用 organization 的 SAML 入口
- [ ] **T3.7** 为 SAML 流程编写集成测试
- [ ] **T3.8** 预留 SCIM 2.0 接口结构（可选 / v0.5 不强制实现）
  - `GET /scim/v2/Users`、`POST /scim/v2/Users` 等路由占位
  - 返回 501 Not Implemented 或基础 CRUD 骨架

## 阶段四：Security settings & data residency（Day 14-16）

- [ ] **T4.1** 实现 `GET /api/organizations/[id]/security`
- [ ] **T4.2** 实现 `PUT /api/organizations/[id]/security`
  - enforceSso / allowedDomains / auditRetentionDays / requireMfa
- [ ] **T4.3** 在文件上传路径中记录数据驻留 region
- [ ] **T4.4** 拦截 SSO 强制策略：未通过 SSO 登录时拒绝访问 organization 资源
- [ ] **T4.5** 在全局审计日志中记录 organization 级别安全事件

## 阶段五：Frontend & migration（Day 17-19）

- [ ] **T5.1** 前端：Organization 设置页
  - 基础信息 / region / 删除
- [ ] **T5.2** 前端：Organization 成员管理页
- [ ] **T5.3** 前端：SAML 配置页
- [ ] **T5.4** 前端：SecuritySettings 配置页
- [ ] **T5.5** 更新 Workspace 选择器，展示所属 organization
- [ ] **T5.6** 为现有用户添加创建个人 Organization 的可选引导

## 阶段六：Tests & docs（Day 20-21）

- [ ] **T6.1** 单元测试：organization CRUD、成员权限
- [ ] **T6.2** 集成测试：SAML 登录完整流程
- [ ] **T6.3** E2E：创建 organization → 邀请成员 → 设置 SSO
- [ ] **T6.4** 更新文档：`docs/features/organizations-and-sso.md`
- [ ] **T6.5** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 用户能创建 Organization 并邀请成员
- [ ] Organization owner 能管理下属 Workspace
- [ ] SAML 配置后，用户可通过企业 IdP 登录
- [ ] SecuritySettings 能强制要求 SSO
- [ ] 数据驻留设置影响上传存储路径（至少按配置记录）

## 风险 / 注意事项

1. **SSO 依赖外部 IdP**：IdP 元数据变更需支持重新导入。
2. **现有用户迁移**：默认 organizationId 为 null，不影响现有 workspace。
3. **JWT 声明**：登录后 token 需包含 organization 信息以便权限校验。
4. **数据驻留实现**：v0.5 先记录 region，完整按 region 路由存储可后续扩展。

## 依赖

- ISSUE-007（Billing 按 workspace，需兼容 organization 层级）

## 预估工期

3 周
