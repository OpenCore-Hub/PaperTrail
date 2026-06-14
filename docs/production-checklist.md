# DocHub 生产部署检查清单

> 本清单面向自托管 / VPS 部署。若使用 Vercel、Railway、Render 等平台，可将 `docker-compose.prod.yml` 和 `Dockerfile` 作为参考，数据库和 Redis 改用平台托管服务。

## 1. 环境变量（.env.production.local）

复制以下模板，填入真实值：

```bash
# 应用基础
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=            # 随机 32 字节以上字符串：openssl rand -base64 32
NEXT_PUBLIC_APP_DOMAIN=your-domain.com

# 数据库
DATABASE_URL=postgresql://user:pass@db:5432/dochub

# Redis（用于跨实例共享限流窗口；留空则回退到内存）
REDIS_URL=redis://redis:6379

# 文件存储
UPLOADTHING_TOKEN=          # 从 uploadthing.com 获取

# 邮件（团队邀请、密码重置）
RESEND_API_KEY=             # 从 resend.com 获取
EMAIL_FROM_ADDRESS=notifications@your-domain.com  # 必须在 Resend 验证过

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# 自定义域名
CUSTOM_DOMAIN_CNAME_TARGET=your-domain.com  # 或 A 记录目标 IP

# Cron 清理任务密钥
CRON_SECRET=                # 随机字符串，外部 cron 调用时放在 Authorization: Bearer <token>
```

## 2. 首次部署步骤

```bash
# 1. 确认环境变量已写入 .env.production.local

# 2. 启动数据库和 Redis
docker-compose -f docker-compose.prod.yml up -d db redis

# 3. 应用数据库迁移
# 方式 A：在宿主机（需 NODE_ENV 与 DATABASE_URL）
npx prisma migrate deploy

# 方式 B：在 app 容器内
# docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 4. 构建并启动应用
docker-compose -f docker-compose.prod.yml up -d --build app
```

## 3. 定时清理任务

`/api/cron/cleanup` 默认需要 `CRON_SECRET`，需要外部 cron 触发。

### 使用系统 cron（推荐 VPS）

```bash
# crontab -e
0 3 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/cleanup
```

### 使用 Vercel Cron

在 `vercel.json` 中添加：

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

## 4. 邮件与 OAuth

- 在 Resend 验证 `EMAIL_FROM_ADDRESS` 域名，否则邮件会进垃圾箱或被拒。
- 在 Google Cloud Console 配置 OAuth 2.0 客户端：
  - 授权 JavaScript 来源：`https://your-domain.com`
  - 授权重定向 URI：`https://your-domain.com/api/auth/callback/google`

## 5. 自定义域名

1. 管理员在 `/dashboard/settings/team` 添加域名。
2. 在 DNS 添加 CNAME：`docs.brand.com` → `your-domain.com`（或 `CUSTOM_DOMAIN_CNAME_TARGET` 指定的目标）。
3. 等待验证后，新建的分享链接会自动使用该域名。
4. 确保生产服务器的 Web 服务器 / 负载均衡能接收并转发该 Host 头。

## 6. 部署后验证

```bash
# 健康检查
curl https://your-domain.com/api/health

# 运行手动 E2E 清单
# 见 scripts/e2e-checklist.md
```

## 7. 安全与备份

- [ ] 数据库开启自动备份（或云数据库快照）。
- [ ] UploadThing 文件保留策略符合合规要求。
- [ ] `NEXTAUTH_SECRET`、`CRON_SECRET` 使用随机强密码，不提交到仓库。
- [ ] 生产服务器防火墙仅开放 80/443。
- [ ] 使用 HTTPS（Let's Encrypt / 云证书）。
- [ ] 定期检查 `npm audit` 和依赖更新。

## 8. 监控建议（可选下一步）

- 接入 Sentry 或 Logrocket 捕获前端/后端错误。
- 对 `/api/health` 做 uptime 监控。
- 对 PostgreSQL 和 Redis 做资源告警。
