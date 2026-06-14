# DocHub 上线部署命令与检查清单

> 本文档面向首次将 DocHub 部署到生产环境。假设使用 **Docker Compose** 自建部署；若使用 Vercel/Railway/Render 等平台，可将对应步骤替换为平台提供的流程。

---

## 前置条件

- [ ] 一台 Linux/macOS 服务器（建议 2C4G 以上，SSD 磁盘）。
- [ ] 服务器已安装 Docker 与 Docker Compose（Docker Engine ≥ 24.0）。
- [ ] 一个已注册并解析到服务器的域名（例如 `docs.example.com`）。
- [ ] 可选：如需自定义域名功能，准备一条可配置 CNAME 的测试子域名。
- [ ] 已在 [UploadThing](https://uploadthing.com) 创建 app 并获取 token。
- [ ] 已在 [Resend](https://resend.com) 注册并验证发送域名。
- [ ] 已在 Google Cloud Console 创建 OAuth 2.0 客户端（可选，不启用 Google 登录可跳过）。

---

## 1. 准备环境变量

在服务器项目根目录创建 `.env.production.local`：

```bash
cat > .env.production.local << 'EOF'
# 应用基础
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://docs.example.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_APP_DOMAIN=docs.example.com

# 数据库（docker-compose.prod.yml 中 db 服务的连接串）
DATABASE_URL=postgresql://dochub:change-me-in-env@db:5432/dochub

# Redis（限流共享窗口，留空则回退内存）
REDIS_URL=redis://redis:6379

# 文件存储
UPLOADTHING_TOKEN=<your-uploadthing-token>

# 邮件
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM_ADDRESS=notifications@docs.example.com

# Google OAuth（可选）
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# 自定义域名 CNAME 目标（填写你的服务器域名或 IP）
CUSTOM_DOMAIN_CNAME_TARGET=docs.example.com

# Cron 清理密钥
CRON_SECRET=<openssl rand -base64 24>

# 备份
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=7
BACKUP_SCHEDULE="0 3 * * *"
S3_BACKUP_BUCKET=                    # 可选
EOF
```

> **安全提醒**：`.env.production.local` 不会被提交到 Git（已加入 `.gitignore`）。生产 secret 禁止写入代码仓库。

---

## 2. 拉取代码

```bash
git clone https://github.com/OpenCore-Hub/PaperTrail.git dochub
cd dochub
git checkout dev
```

---

## 3. 启动数据库与 Redis

```bash
docker-compose -f docker-compose.prod.yml up -d db redis
```

等待健康检查通过：

```bash
docker-compose -f docker-compose.prod.yml ps
```

---

## 4. 应用数据库迁移

```bash
# 方式 A：本地已安装 Node.js 20+
npm ci
npm run db:generate
npx prisma migrate deploy

# 方式 B：在 app 容器内执行（无需本地 Node）
# docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
```

---

## 5. 构建并启动应用与备份服务

```bash
docker-compose -f docker-compose.prod.yml up -d --build app backup
```

查看日志：

```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

---

## 6. 配置反向代理与 HTTPS

DocHub 容器暴露 `3000` 端口。建议使用 **Caddy** 自动获取 Let's Encrypt 证书：

```bash
# /etc/caddy/Caddyfile
docs.example.com {
  reverse_proxy localhost:3000
}
```

重载 Caddy：

```bash
sudo systemctl reload caddy
```

或使用 Nginx：

```nginx
server {
  listen 443 ssl http2;
  server_name docs.example.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> 自定义域名功能依赖 `Host` 头正确转发，反向代理必须保留 `proxy_set_header Host $host;`。

---

## 7. 配置外部 Cron 清理任务

```bash
# 编辑 crontab
sudo crontab -e

# 每天 03:00 执行清理
0 3 * * * /usr/bin/curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://docs.example.com/api/cron/cleanup
```

---

## 8. 配置 OAuth、邮件与自定义域名

### Google OAuth

在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 中：

- **Authorized JavaScript origins**: `https://docs.example.com`
- **Authorized redirect URIs**: `https://docs.example.com/api/auth/callback/google`

### Resend 邮件

- 在 Resend 中验证 `EMAIL_FROM_ADDRESS` 的域名。
- 发送测试邮件：

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"notifications@docs.example.com","to":"you@example.com","subject":"DocHub test","html":"<p>OK</p>"}'
```

### 自定义域名（可选）

1. 在 workspace settings 添加自定义域名（如 `brand.example.com`）。
2. 在 DNS 添加 CNAME：`brand.example.com` → `docs.example.com`。
3. 等待验证通过后创建分享链接，确认 URL 使用自定义域名。

---

## 9. 上线验证

### 9.1 健康检查

```bash
curl -s https://docs.example.com/api/health | jq .
```

期望 `database` 为 `ok`。若未配置 UploadThing，`storage` 可能为 `error`，需在环境变量中配置真实 token 后重试。

### 9.2 核心链路手动验证

运行项目自带的 E2E 检查清单：

```bash
# 本地或 CI 中运行
npm run test:e2e
```

若在生产环境手动验证，参考 `scripts/e2e-checklist.md` 执行：

- [ ] 注册账号并创建 workspace。
- [ ] 上传一个 PDF。
- [ ] 创建带密码的分享链接。
- [ ] 在无痕窗口打开链接，输入密码后查看 PDF。
- [ ] 返回 dashboard 查看 analytics 数据。
- [ ] 发送一条团队邀请并确认邮件送达。

### 9.3 备份验证

```bash
# 手动触发一次备份
docker-compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup-db.sh

# 确认 backups/ 目录出现 .dump 文件
ls -lh backups/
```

---

## 10. 回滚方案

### 应用回滚

```bash
docker-compose -f docker-compose.prod.yml down
git log --oneline -n 5          # 找到上一个稳定 commit
git checkout <stable-commit>
docker-compose -f docker-compose.prod.yml up -d --build app
```

### 数据库回滚

```bash
# 找到最近一个可用备份
ls -t backups/dochub_*.dump | head -n 1

# 恢复到原数据库（会覆盖当前数据，谨慎操作）
DATABASE_URL=postgresql://dochub:change-me-in-env@db:5432/dochub \
  ./scripts/restore-db.sh backups/dochub_YYYYMMDD_HHMMSS.dump
```

---

## 11. 上线后 24 小时 / 7 天

| 时间 | 动作 |
|---|---|
| 0–2h | 确认 `/api/health` 持续正常；检查 Sentry 无新增错误。 |
| 24h | 检查备份目录是否生成新的 `.dump` 文件；确认 cron 清理日志。 |
| 7d | 做一次备份恢复到临时数据库的演练；检查磁盘使用率。 |
| 持续 | 监控 `POSTGRES`/`REDIS` 资源；定期 `npm audit`；关注 UploadThing 用量。 |

---

## 一键命令速查

```bash
# 首次部署
docker-compose -f docker-compose.prod.yml up -d db redis
npm ci && npm run db:generate && npx prisma migrate deploy
docker-compose -f docker-compose.prod.yml up -d --build app backup

# 查看状态
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f app

# 更新代码后重新部署
git pull origin dev
docker-compose -f docker-compose.prod.yml up -d --build app

# 手动备份
docker-compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup-db.sh

# 重启
docker-compose -f docker-compose.prod.yml restart app
```

---

## 紧急联系人 / 运维备注

- **数据库备份目录**: `./backups/`
- **健康检查**: `GET https://<your-domain>/api/health`
- **Sentry 项目**: 配置 `NEXT_PUBLIC_SENTRY_DSN` 后自动生效
- **主要日志**: `docker-compose -f docker-compose.prod.yml logs -f app`
