# [ISSUE-015] v0.5 Plugin System

## 目标

建立插件系统，允许自定义 AI Provider、Storage Provider、Viewer Component、Workflow Action 等扩展点。

## 关联 ADR

`docs/adr/003-v0.5-autonomous-document-intelligence-platform.md` 第 8 节

## 已确认决策

- v0.5 先实现 in-repo 插件加载，不开放第三方市场。
- 插件声明所需权限，运行在受限 worker/沙箱。
- 未来独立 `@dochub/plugin-sdk` 包。

## 阶段一：Schema & interface design（Day 1-3）

- [ ] **T1.1** 新增 Prisma 模型 `Plugin`
  - 字段：`id`、`workspaceId`、`name`、`version`、`manifest`、`entryPath`、`permissions`、`enabled`、`createdAt`、`updatedAt`
- [ ] **T1.2** 定义插件 manifest 类型与 JSON Schema
- [ ] **T1.3** 设计插件接口 `IDochubPlugin`
  - 生命周期：`init`、`dispose`
- [ ] **T1.4** 设计扩展点注册机制
  - AI Provider / Storage Provider / Viewer Component / Workflow Action
- [ ] **T1.5** 生成 migration 并运行 `npx prisma generate`

## 阶段二：Provider extension points（Day 4-7）

- [ ] **T2.1** 实现 AI Provider 扩展点
  - 插件可实现 `IAiProvider` 并注册到 `AiProviderFactory`
- [ ] **T2.2** 实现 Storage Provider 扩展点
  - 插件可实现 `IStorageProvider` 并注册到 `StorageFactory`
- [ ] **T2.3** 实现 Workflow Action 扩展点
  - 插件可注册自定义 workflow action handler
- [ ] **T2.4** 实现 Viewer Component 扩展点
  - 插件可注册 React 组件供 viewer 动态加载
- [ ] **T2.5** 为每个扩展点定义类型契约与输入/输出
- [ ] **T2.6** 编写示例插件：`hello-world-plugin`

## 阶段三：Sandbox & loader（Day 8-10）

- [ ] **T3.1** 实现插件加载器 `lib/plugins/loader.ts`
  - 扫描 `plugins/` 目录并加载 manifest
- [ ] **T3.2** 实现权限校验：插件声明权限 vs 实际调用
- [ ] **T3.3** 确定并实现受限沙箱机制
  - 选型：isolated-vm 或 WebAssembly
  - 明确禁止的系统调用与网络访问范围
- [ ] **T3.4** 捕获插件异常，避免影响主应用启动
- [ ] **T3.5** 实现热重载：开发环境下插件变更自动重载
- [ ] **T3.6** 为加载器与沙箱添加单元测试

## 阶段四：Frontend management（Day 11-12）

- [ ] **T4.1** 前端：Plugin 管理页面
  - 启用/禁用、查看 manifest、权限
- [ ] **T4.2** 前端：Plugin Registry 列表
  - 展示 in-repo 可用插件
- [ ] **T4.3** 前端：动态加载 Viewer Component 扩展
- [ ] **T4.4** 在设置中展示插件权限警告

## 阶段五：Tests & docs（Day 13-14）

- [ ] **T5.1** 单元测试：插件 manifest 解析、权限校验
- [ ] **T5.2** 集成测试：AI Provider 插件接入聊天流程
- [ ] **T5.3** 集成测试：Storage Provider 插件处理上传/下载
- [ ] **T5.4** 集成测试：插件异常不影响主应用启动
- [ ] **T5.5** 更新文档：`docs/features/plugin-system.md`
- [ ] **T5.6** 运行完整验证：`npm run validate`

## 验收标准

- [ ] 用户能启用/禁用插件
- [ ] 自定义 AI Provider 插件能被用于聊天
- [ ] 自定义 Storage Provider 插件能处理上传/下载
- [ ] 插件权限超限时被拒绝
- [ ] 插件加载失败不影响主应用启动

## 风险 / 注意事项

1. **安全性**：第三方代码执行必须严格沙箱化，v0.5 仅开放 in-repo 降低风险。
2. **API 稳定性**：扩展点接口需在 `@dochub/plugin-sdk` 中提前设计好版本策略。
3. **性能开销**：插件过多或沙箱切换频繁可能影响响应时间。

## 依赖

- ISSUE-001（IStorageProvider）
- ISSUE-004（IAiProvider）
- ISSUE-008（Workflows）

## 预估工期

2 周
