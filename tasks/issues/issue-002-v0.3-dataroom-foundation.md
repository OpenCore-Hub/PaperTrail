# [ISSUE-002] v0.3 Dataroom Foundation

## 目标

实现数据室（Dataroom）的基础骨架：创建/编辑/删除数据室、文件夹树、文档挂载、基础权限，让多个文档能按项目/交易组织。

## 关联 ADR

`docs/adr/001-v0.3-ai-native-dataroom-and-document-persistence.md` 第 4 节

## 已确认决策

- v0.3 权限先到用户级；ViewerGroup 留到 v0.4。
- 文件夹支持无限嵌套（自引用 `parentId`）。
- 文档挂载通过 `DataroomDocument` 关联表实现。
- Dataroom 自定义域名 v0.3 先独立配置（不与 Workspace 自定义域名合并）。

## 阶段一：数据模型与 API（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型：`Dataroom`、`DataroomFolder`、`DataroomDocument`、`DataroomPermission`、`DataroomRole`
- [ ] **T1.2** 实现 `GET/POST /api/datarooms`
  - 列表按 `updatedAt` 排序
  - 创建时校验 workspace plan 是否允许 Dataroom
- [ ] **T1.3** 实现 `GET/PATCH/DELETE /api/datarooms/[id]`
  - PATCH 支持 name/description/brand/customDomain
  - DELETE 级联删除 folders 和 dataroomDocuments，不删原始 Document
- [ ] **T1.4** 实现 `GET/POST /api/datarooms/[id]/folders`
  - 支持嵌套 parentId
  - 返回树形结构
- [ ] **T1.5** 实现 `GET/POST /api/datarooms/[id]/documents`
  - POST 挂载 document，支持指定 folderId 和 order

## 阶段二：前端页面（Day 4-6）

- [ ] **T2.1** 创建 `app/dashboard/datarooms/page.tsx`
  - Dataroom 卡片列表
  - 创建 Dataroom 按钮/弹窗
- [ ] **T2.2** 创建 `app/dashboard/datarooms/[id]/page.tsx`
  - 左侧文件夹树
  - 右侧文档列表（按 folder/order 排序）
  - 顶部面包屑与操作栏
- [ ] **T2.3** 创建 `components/dataroom/folder-tree.tsx`
  - 支持展开/折叠、重命名、删除、新建子文件夹
- [ ] **T2.4** 创建 `components/dataroom/document-list.tsx`
  - 展示已挂载文档，支持移除

## 阶段三：权限与交互（Day 7-9）

- [ ] **T3.1** 实现权限校验 helper：`canManageDataroom(user, dataroom)`
- [ ] **T3.2** 在 API 中统一检查 ADMIN/EDITOR 才能修改 Dataroom
- [ ] **T3.3** 实现文档拖入 Dataroom
  - Dashboard 文档列表支持拖放到 Dataroom
  - Dataroom 内支持拖放到文件夹
- [ ] **T3.4** 实现文档排序（Dataroom 内 drag-and-drop）
- [ ] **T3.5** 为 Dataroom 创建分享链接入口（复用 CreateLinkDialog，后续 ISSUE-003 扩展）
- [ ] **T3.6** 明确 Dataroom `customDomain` 策略
  - v0.3 支持独立 customDomain 字段
  - 校验域名归属、HTTPS、CNAME 配置留到 v0.4
- [ ] **T3.7** Dataroom 权限变更（成员/角色调整）写入 `lib/audit.ts`

## 阶段四：测试与验证（Day 10-11）

- [ ] **T4.1** 单元测试：folder tree 构建与扁平化
- [ ] **T4.2** E2E：创建 Dataroom → 添加文件夹 → 挂载文档 → 删除 Dataroom
- [ ] **T4.3** E2E：未授权用户访问他人 Dataroom 返回 403
- [ ] **T4.4** 验证删除 Dataroom 不级联删除原始 Document

## 验收标准

- [ ] 用户能创建 Dataroom、添加文件夹、挂载文档
- [ ] 文件夹支持嵌套和重命名
- [ ] 未授权用户无法查看/编辑不属于自己的 Dataroom
- [ ] Dataroom 删除级联删除其文件夹和挂载关系，但不删除原始 Document

## 风险 / 注意事项

1. **文件夹循环**：API 需校验 `parentId` 不能形成循环引用。
2. **排序并发**：多个用户同时调整文档顺序时，以 server timestamp 为准。
3. **权限粒度**：v0.3 只到用户级，避免过早实现复杂 RBAC。

## 依赖

- ISSUE-001（DocumentVersion/Document 模型）

## 预估工期

1.5 周
