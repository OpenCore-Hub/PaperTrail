# [ISSUE-016] v0.x Client-Side Encryption (E2EE) Backlog

## 目标

为高合规场景预留端到端加密（E2EE）能力：文档在上传前由客户端加密，服务端仅存储密文，只有持密钥的查看者能解密。作为战略 backlog，不在 v0.3-v0.5 主路径中实现。

## 关联 ADR

`docs/adr/003-v0.5-autonomous-document-intelligence-platform.md` 第 4.3 节

## 已确认决策

- E2EE 与 AI 解析存在根本矛盾：加密文档无法被 AI 索引。
- 若未来支持，必须让用户在「可 AI 索引」与「端到端加密」之间二选一。
- v0.5 及之前不实现，仅作为架构预留。

## 待决策问题

- [ ] 密钥管理：用户自托管密钥，还是平台托管密钥派生？
- [ ] 加密范围：仅 PDF 内容，还是包含批注、文件名、元数据？
- [ ] Viewer 解密：浏览器端 WASM 解密，还是服务端临时解密后丢弃？
- [ ] 与现有权限模型（Link、ViewerGroup、NDA）如何共存？

## 验收标准（未来实现时）

- [ ] 上传前客户端完成 AES-256-GCM 加密
- [ ] 服务端持久化层无法读取明文
- [ ] 授权查看者能在浏览器端解密并查看
- [ ] 选择 E2EE 的文档不参与 AI 索引

## 依赖

- ISSUE-001（DocumentVersion 模型）
- ISSUE-004（AI Infrastructure）
- ISSUE-013（Annotation / Collaboration，若加密范围包含批注）

## 预估工期

未排期（backlog）
