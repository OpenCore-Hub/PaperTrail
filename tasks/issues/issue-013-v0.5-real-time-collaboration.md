# [ISSUE-013] v0.5 Real-Time Collaboration

## 目标

实现 PDF 批注、评论、版本对比，让用户能在文档上直接协作。

## 关联 ADR

`docs/adr/003-v0.5-autonomous-document-intelligence-platform.md` 第 6 节

## 已确认决策

- 批注类型：高亮、备注、签名、涂鸦。
- 实时性采用轮询 + 乐观更新，v0.5 不引入 WebSocket。
- 版本对比展示 side-by-side 差异。

## 阶段一：Schema & API（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型 `DocumentAnnotation`
  - 字段：`id`、`documentVersionId`、`type`、`pageNumber`、`position`、`content`、`createdBy`、`createdAt`、`updatedAt`
- [ ] **T1.2** 新增 Prisma 模型 `AnnotationComment`
  - 字段：`id`、`annotationId`、`userId`、`content`、`createdAt`
- [ ] **T1.3** 实现 Annotation CRUD API：`/api/document-versions/[id]/annotations`
- [ ] **T1.4** 实现 Annotation 评论 API：`/api/annotations/[id]/comments`
- [ ] **T1.5** 权限校验：仅 document version 可访问用户可查看/创建批注
- [ ] **T1.6** 生成 migration 并运行 `npx prisma generate`

## 阶段二：PDF viewer annotation layer（Day 4-7）

- [ ] **T2.1** 在 PDF viewer 上绘制批注层（overlay）
- [ ] **T2.2** 实现高亮批注创建与渲染
- [ ] **T2.3** 实现备注批注（pin + popover）
- [ ] **T2.4** 实现签名批注占位（图片/手写签名框）
- [ ] **T2.5** 实现涂鸦批注（简单 canvas 绘制）
- [ ] **T2.6** 乐观更新本地批注状态，失败时回滚

## 阶段三：Comments & threads（Day 8-10）

- [ ] **T3.1** 实现批注评论线程 UI
- [ ] **T3.2** 实现评论创建、删除、回复
- [ ] **T3.3** 在批注上展示未读/已解决状态
- [ ] **T3.4** 通知被 @ 的用户或批注创建者
- [ ] **T3.5** 为评论 API 添加单元测试

## 阶段四：Version compare（Day 11-12）

- [ ] **T4.1** 实现版本对比 API：`/api/documents/[id]/compare`
  - 输入：`baseVersionId`、`targetVersionId`
  - 输出：文本差异段落
- [ ] **T4.2** 复用 ISSUE-006 文档对比能力，接入 DocumentVersion
- [ ] **T4.3** 前端：版本对比页面
  - side-by-side 展示
  - 新增/删除/修改高亮
- [ ] **T4.4** 在版本选择器中支持发起对比

## 阶段五：Polling & tests（Day 13-14）

- [ ] **T5.1** 实现每 5 秒轮询同步他人批注
- [ ] **T5.2** 去重与合并远程批注，避免闪烁
- [ ] **T5.3** 单元测试：annotation CRUD、权限
- [ ] **T5.4** E2E：创建批注 → 评论 → 轮询同步
- [ ] **T5.5** E2E：版本对比 → 验证差异高亮
- [ ] **T5.6** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 用户能在 PDF 上添加高亮和备注
- [ ] 其他用户能看到新增批注（经轮询）
- [ ] 用户能对批注进行评论
- [ ] 能对比两份 DocumentVersion 的文本差异
- [ ] 批注按版本隔离，不污染历史版本

## 风险 / 注意事项

1. **批注坐标一致性**：PDF 缩放、旋转后需保证批注位置正确。
2. **轮询频率**：5 秒间隔可能带来延迟感，v0.6 可升级 WebSocket。
3. **版本隔离**：批注必须绑定到 `documentVersionId`，不能跨版本显示。

## 依赖

- ISSUE-001（DocumentVersion 模型）

## 预估工期

2 周
