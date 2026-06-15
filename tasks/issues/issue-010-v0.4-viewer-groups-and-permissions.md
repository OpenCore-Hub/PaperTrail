# [ISSUE-010] v0.4 Viewer Groups & Advanced Permissions

## 目标

实现查看者分组，支持按分组授予 Dataroom/Link 访问权限，并用 AI 推荐合适的分组。

## 关联 ADR

`docs/adr/002-v0.4-dataroom-intelligence-layer-and-growth-stack.md` 第 6 节

## 已确认决策

- 一个 viewer group 包含一组 email。
- Link 和 Dataroom 均可绑定多个 group。
- AI 根据文档内容推荐应授权的域名/组织。

## 阶段一：Schema & API（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型：
  - `ViewerGroup`（workspaceId / name / description）
  - `ViewerGroupMember`（viewerGroupId / email）
  - `LinkViewerGroup`（linkId / viewerGroupId）
- [ ] **T1.2** 扩展 `DataroomPermission` 模型
  - 新增 `viewerGroupId` 字段
- [ ] **T1.3** 实现 Viewer Group CRUD API
  - `GET /api/viewer-groups`
  - `POST /api/viewer-groups`
  - `PUT /api/viewer-groups/[id]`
  - `DELETE /api/viewer-groups/[id]`
- [ ] **T1.4** 实现成员批量增删 API
  - `POST /api/viewer-groups/[id]/members`
  - `DELETE /api/viewer-groups/[id]/members/[email]`

## 阶段二：Link & Dataroom Access Control（Day 4-6）

- [ ] **T2.1** 更新 Link 访问校验逻辑
  - 若 Link 绑定了 viewer groups，验证 viewer email 是否属于任一 group
- [ ] **T2.2** 更新 Dataroom 访问校验逻辑
  - 结合现有 password/NDA/email 限制，增加 group 校验
- [ ] **T2.3** 在访问会话中记录解析出的 group 信息
- [ ] **T2.4** group 成员变更后，已有访问会话按新权限生效
  - 会话校验时实时查询 group 成员表
- [ ] **T2.5** 手动回归：非 group 成员无法访问 Link/Dataroom

## 阶段三：AI 推荐 Viewer Group（Day 7-8）

- [ ] **T3.1** 实现 `lib/ai/suggest-viewer-groups.ts`
  - 解析文档内容中的域名/组织信息
  - 推荐应授权的 Viewer Group 草稿
- [ ] **T3.2** 实现 `POST /api/ai/suggestions/viewer-groups`
  - 输入：documentId / dataroomId
  - 输出：建议的 group 名称与 email 列表
- [ ] **T3.3** 将 AI 推荐接入 Link/Dataroom 权限设置
  - 用户可一键采纳为新的 Viewer Group
- [ ] **T3.4** 对 AI 推荐结果做合规过滤
  - 过滤个人邮箱、黑名单域名

## 阶段四：Frontend（Day 9-10）

- [ ] **T4.1** 前端：Viewer Group 管理页
  - 列表、创建、编辑、删除、批量导入成员
- [ ] **T4.2** 前端：Link 权限设置中添加 group 选择
  - 多选 group、展示已选 group 的成员数
- [ ] **T4.3** 前端：Dataroom 权限设置中添加 group 选择
- [ ] **T4.4** 前端：AI 推荐 Viewer Group 弹窗
  - 展示推荐结果，支持一键采纳与编辑

## 阶段五：Tests（Day 11）

- [ ] **T5.1** 单元测试：Link/Dataroom group 访问校验逻辑
- [ ] **T5.2** 单元测试：AI 推荐域名/组织提取
- [ ] **T5.3** 集成测试：创建 group → 绑定 Link → 成员访问/非成员拒绝
- [ ] **T5.4** 集成测试：group 成员变更后实时生效
- [ ] **T5.5** 运行完整验证：`npm run validate`
- [ ] **T5.6** Viewer Group 与 Link/Dataroom 权限绑定变更写入 `lib/audit.ts`

## 验收标准

- [ ] 用户能创建 Viewer Group 并添加成员邮箱
- [ ] 只有 group 成员能访问绑定的 Link/Dataroom
- [ ] AI 能为文档推荐合适的 Viewer Group 草稿
- [ ] group 成员变更后，已有访问会话按新权限生效

## 风险 / 注意事项

1. **权限组合复杂性**：Link/Dataroom 可能同时存在 password、NDA、email domain、viewer group 限制，需明确优先级与组合规则。
2. **AI 推荐准确性**：推荐结果仅为草稿，必须经用户确认后才写入权限。
3. **性能**：Dataroom 访问量大时，group 成员校验需命中索引。

## 依赖

- ISSUE-002（Dataroom Foundation）
- ISSUE-003（Enterprise Link Governance）

## 预估工期

1.5 周
