# [ISSUE-003] v0.3 Enterprise Link Governance

## 目标

扩展 `ShareLink`，支持企业级访问控制：水印、允许/拒绝名单、NDA 门、截图保护、自定义 OG、标签，让单文档分享达到 Papermark 高阶链接能力。

## 关联 ADR

`docs/adr/001-v0.3-ai-native-dataroom-and-document-persistence.md` 第 5 节

## 已确认决策

- `ShareLink` 新增 `dataroomId`（nullable），与 `documentId` 互斥。
- 前端 `CreateLinkDialog` 升级为 `LinkSheet`。
- 水印 v0.3 先用前端 Canvas overlay。
- NDA 使用简单文本协议，签署记录存 `AgreementResponse`。

## 阶段一：Schema 与迁移（Day 1-2）

- [ ] **T1.1** 扩展 `ShareLink` 模型：
  - `watermarkText`, `watermarkConfig`
  - `allowList`, `denyList`
  - `agreementId`
  - `screenshotProtection`, `confidentialView`
  - `customFields`, `metaTags`, `welcomeMessage`, `enableQuestion`, `questionText`
  - `tags`
- [ ] **T1.2** 新增 `Agreement` 与 `AgreementResponse` 模型
- [ ] **T1.3** 添加数据库 CHECK 约束：
  ```sql
  CHECK ((document_id IS NOT NULL AND dataroom_id IS NULL) OR (document_id IS NULL AND dataroom_id IS NOT NULL))
  ```
- [ ] **T1.4** 生成 migration 并验证

## 阶段二：后端访问控制（Day 3-5）

- [ ] **T2.1** 更新 `POST /api/share` 与 `PATCH /api/share/[id]` 支持新字段
- [ ] **T2.2** 在 `viewer-gate` 中实现 allowList / denyList 邮箱校验
- [ ] **T2.3** 实现 `screenshotProtection` / `confidentialView` 响应头与前端禁止右键/复制策略
- [ ] **T2.4** 实现自定义问题门（`enableQuestion` + `questionText`）与信息收集字段（`customFields`）
- [ ] **T2.5** 实现 `metaTags` 与 `welcomeMessage` 的 viewer 注入

## 阶段三：前端 LinkSheet 与 viewer gate（Day 6-8）

- [ ] **T3.1** 将 `CreateLinkDialog` 重命名为 `LinkSheet` 并重构为侧边栏/抽屉形态
- [ ] **T3.2** 在 `LinkSheet` 中新增表单分区：水印、允许/拒绝名单、NDA、截图保护、自定义 OG、标签
- [ ] **T3.3** 实现 viewer 内 Canvas 水印 overlay
  - 读取 `watermarkText` / `watermarkConfig`
- [ ] **T3.4** 将 `LinkSheet` 配置打通至 viewer gate（问题、欢迎语、邮箱校验）

## 阶段四：NDA 与协议流程（Day 9-10）

- [ ] **T4.1** 创建 `POST /api/share/[id]/agreement`
  - 接收 viewer 提交的同意确认
  - 写入 `AgreementResponse`
- [ ] **T4.2** 创建 `GET /api/share/[id]/agreement`
  - 校验当前 viewer 是否已完成签署
- [ ] **T4.3** 前端：viewer 加载前弹出 NDA 模态框，未签署不可查看文档
- [ ] **T4.4** 后台：按 `agreementId` 渲染 NDA 文本并记录签署时间/IP/邮箱

## 阶段五：测试（Day 11）

- [ ] **T5.1** 单元测试：`viewer-gate` allowList / denyList / NDA 校验逻辑
- [ ] **T5.2** E2E：NDA 签署 → viewer 正常加载
- [ ] **T5.3** E2E：denyList 邮箱访问被拦截
- [ ] **T5.4** 运行 `npm run validate`

## 验收标准

- [ ] `ShareLink` 的 `dataroomId` / `documentId` 互斥，migration 通过
- [ ] viewer 根据 allowList / denyList 正确放行或拦截访问
- [ ] NDA 未签署时 viewer 不可见，签署后写入 `AgreementResponse`
- [ ] Canvas 水印在 viewer 中可见
- [ ] `metaTags` 正确渲染自定义 OG 信息
- [ ] `npm run build`、`npm test`、`npx prisma migrate deploy` 全部通过

## 风险 / 注意事项

1. **前端水印不是安全边界**：Canvas overlay 可被浏览器开发者工具绕过，v0.4 再考虑服务端渲染或盲水印。
2. **NDA 法律效力**：v0.3 使用简单文本协议，仅作访问控制，不构成法律约束。
3. **现有 ShareLink 兼容**：新增字段均为 nullable，旧链接默认保持原有行为。
4. **数据隐私**：`AgreementResponse` 记录邮箱/IP，需遵守隐私政策与数据保留策略。

## 依赖

- ISSUE-002（Dataroom Foundation）

## 预估工期

1.5 周
