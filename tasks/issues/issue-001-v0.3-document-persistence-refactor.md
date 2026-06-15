# [ISSUE-001] v0.3 Document Persistence Refactor

## 目标

将 `Document` 表的物理文件职责剥离，建立 `DocumentVersion` + `IStorageProvider` 架构，使 DocHub 支持文档版本、多存储后端、AI 解析，并保持现有 viewer/分享/分析功能零中断。

## 关联 ADR

`docs/adr/001-v0.3-ai-native-dataroom-and-document-persistence.md` 第 3 节

## 已确认决策

- `Document` 仅保留逻辑元数据；物理文件信息移至 `DocumentVersion`。
- 默认 `UploadThingStorageProvider`，通过 `STORAGE_PROVIDER` 环境变量可切换。
- latest version 通过 `ORDER BY versionNumber DESC LIMIT 1` 查询。
- 旧字段保留 nullable，v0.4 正式删除。

## 阶段一：存储抽象（Day 1-3）

- [ ] **T1.1** 创建 `lib/storage/types.ts`
  - 定义 `StorageMetadata`、`PutResult`、`IStorageProvider`
- [ ] **T1.2** 创建 `lib/storage/providers/uploadthing-provider.ts`
  - 封装 `@uploadthing/sdk`，实现 `put`、`getSignedUrl`、`delete`、`getStream`
- [ ] **T1.3** 创建 `lib/storage/factory.ts`
  - 根据 `STORAGE_PROVIDER` 返回对应 provider（v0.3 仅 UploadThing）
- [ ] **T1.4** 为 provider 编写单元测试

## 阶段二：数据模型与迁移（Day 4-6）

- [ ] **T2.1** 在 `prisma/schema.prisma` 新增：
  - `enum StorageType { UPLOADTHING S3 LOCAL }`
  - `enum AiIndexStatus { PENDING PROCESSING READY FAILED }`
  - `model DocumentVersion`
- [ ] **T2.2** 修改 `Document` 模型
  - 保留 `storageKey`、`fileSize`、`pageCount` 为 nullable
- [ ] **T2.3** 生成 migration：`npx prisma migrate dev --name document_versions`
- [ ] **T2.4** 在 migration 中 backfill：
  ```sql
  INSERT INTO document_versions (document_id, version_number, storage_key, storage_type, file_size, page_count, content_type, created_by, created_at)
  SELECT id, 1, storage_key, 'UPLOADTHING', file_size, page_count, 'application/pdf', uploaded_by, created_at FROM documents;
  ```
- [ ] **T2.5** 跑通 `npx prisma generate` 与 `npm run type-check`

## 阶段三：应用层改造（Day 7-10）

- [ ] **T3.1** 创建 `lib/documents/get-latest-version.ts`
  - `getLatestVersion(documentId)` helper
- [ ] **T3.2** 修改上传流程 `app/api/documents/route.ts`
  - 创建 `Document` 后立即创建 `DocumentVersion`
  - 保留现有 API 响应结构
- [ ] **T3.3** 修改 viewer 文件服务
  - `app/api/view/pdf/route.ts` 改为通过 `DocumentVersion.storageKey` 获取文件
- [ ] **T3.4** 修改 analytics、share、team 等读取 storageKey 的代码
- [ ] **T3.5** 修改删除文档逻辑：级联删除 `DocumentVersion`（保留物理文件删除）
- [ ] **T3.6** 实现文档版本 API
  - `GET /api/documents/[id]/versions`
  - `POST /api/documents/[id]/versions`（上传新版本）
  - `POST /api/documents/[id]/versions/[versionId]/set-latest`
- [ ] **T3.7** 文档版本变更（创建/设为最新/删除）写入 `lib/audit.ts`

## 阶段四：测试与验证（Day 11-14）

- [ ] **T4.1** 单元测试：`getLatestVersion`、provider factory
- [ ] **T4.2** 更新 E2E：`e2e/upload.spec.ts` 验证 Document + DocumentVersion 同时创建
- [ ] **T4.3** 手动回归：上传、viewer、分享、分析、删除
- [ ] **T4.4** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 新上传文档后，`document_versions` 有且仅有 1 条记录，`versionNumber = 1`
- [ ] 现有文档 migration 后 viewer 能正常打开
- [ ] `STORAGE_PROVIDER=uploadthing` 可省略，`STORAGE_PROVIDER=s3` 返回 not-implemented 错误
- [ ] `npm run build`、`npm test`、`npx prisma migrate deploy` 全部通过

## 风险 / 注意事项

1. **viewer 文件路径**：确保所有获取 PDF 的地方都走 `DocumentVersion`，不要遗留直接读 `Document.storageKey` 的代码。
2. **migration 回滚**：如果失败，保留旧字段 nullable 可快速回滚。
3. **E2E 清理**：`global-teardown.ts` 需同时清理 `DocumentVersion`。

## 依赖

- 无

## 预估工期

2 周
