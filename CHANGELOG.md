# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Structured JSON logging via Pino (`lib/logger.ts`) for production observability.
- Sentry PII scrubbing (`token` query param) and release/environment configuration.
- New E2E tests for analytics dashboard (`e2e/analytics.spec.ts`) and team invitation flow (`e2e/team.spec.ts`).
- **PDF proxy cache** (`lib/pdf-cache.ts`): `/api/view/pdf` caches fetched PDFs on disk with configurable TTL, and the cleanup cron prunes expired entries.
- Unit tests for the PDF cache (`lib/__tests__/pdf-cache.test.ts`).
- **Rate limiting across auth and workspace mutation endpoints**: signup, forgot-password, reset-password, team invite/cancel, share create/update/delete, document delete, and team member update/delete. Uses Redis when `REDIS_URL` is set, with an in-memory fallback.
- **Session invalidation on password reset**: `users.session_version` is incremented when a password is reset; existing JWT sessions are rejected on the next session check.
- **Custom domain periodic re-verification**: DNS is re-checked on every viewer-page request served via a custom domain, and the cleanup cron revokes verification for domains that no longer point to the application.
- Signup route tests including rate-limit behavior (`app/api/auth/signup/__tests__/route.test.ts`).
- **Email verification for password sign-ups**: new `email_verified` column and `email_verification_tokens` table; signup sends a 24-hour verification link via Resend; unverified credentials cannot sign in; Google sign-ins are automatically verified; verification and resend endpoints with rate limiting and tests.
- **Account lockout + hCaptcha on credentials auth**: accounts are temporarily locked after 5 failed login attempts within 15 minutes; sign-in and sign-up forms require hCaptcha verification; Redis-backed with in-memory fallback.
- **Prisma connection pool tuning**: `lib/prisma.ts` now defaults `connection_limit=20` and `pool_timeout=10` on `DATABASE_URL` unless already specified.
- **Graceful shutdown**: `instrumentation.ts` registers SIGTERM/SIGINT handlers that close the Redis connection and disconnect Prisma within a 10-second timeout; `/api/health` returns 503 while shutting down.
- **GDPR data export and account deletion**: new `/api/user/export` and `/api/user/delete` endpoints plus `/dashboard/settings/account` UI for users to download their data or delete their account after password confirmation.
- **Self-hosted PDF.js worker**: the viewer no longer loads the worker from cdnjs; `public/pdf.worker.min.mjs` is copied from `pdfjs-dist` via a `postinstall` script and served locally. Removed cdnjs from the CSP `script-src`.
- **Request ID / correlation tracing**: `lib/async-context.ts` stores per-request context (requestId, path, IP, actor userId); `lib/with-request-context.ts` wraps API handlers so responses include `X-Request-Id`; `getRequestLogger()` automatically enriches Pino logs with these fields.
- **Audit logging**: `lib/audit.ts` emits structured `audit.*` events for sign-in/sign-out, signup, password reset, email verification, document/share/team mutations, and account export/deletion.
- **Structured error logging sweep**: replaced the remaining `console.error` calls in analytics, share, and team invite routes with Pino loggers.

### Changed

- API route handlers for auth, documents, shares, team, user export/delete, and analytics now run inside `withRequestContext` and use request-scoped loggers.

### Changed

- Viewer access grant TTL extended from 5 minutes to 60 minutes; `/api/view/pdf` refreshes the grant on each access so active reading sessions are not interrupted.
- `docker-compose.prod.yml` now mounts a named `pdf_cache` volume at `/app/.cache/pdf` so the PDF proxy cache is shared across container restarts.
- Remaining `console.error` calls in mutation routes migrated to structured Pino logs.

### Changed

- **Analytics aggregation is now pushed to PostgreSQL** (`lib/analytics.ts`) instead of loading all sessions into memory, improving scalability.
- Health check storage probe now verifies `UPLOADTHING_TOKEN` configuration instead of calling UploadThing on every request.
- Docker Compose backup service now reads database credentials from `.env.production.local` to stay consistent with the app service.
- Sign-in page now fetches and passes the NextAuth CSRF token explicitly, fixing E2E and fast-submission scenarios.
- `react-pdf` viewer is now loaded client-only via `next/dynamic`, eliminating SSR crashes and reducing `/v/[slug]` bundle size.
- Added `data-testid` attributes to Share and Manage links buttons for more reliable E2E selectors.

### Fixed

- Prisma migrations were non-contiguous (first migration referenced non-existent tables). Replaced with a single self-contained `20260614000000_init` migration so `prisma migrate deploy` works on fresh databases.
- Stale viewer sessions no longer accumulate duration forever: cleanup cron closes sessions open for more than 4 hours.
- Removed duplicated `getClientIp` implementations; moved to `lib/ip.ts`.
- E2E auth test now waits for the credentials callback's 200 response instead of a 302 redirect.

## [0.2.0] - 2026-06-14

### Added

- Google OAuth provider with automatic workspace creation.
- Workspace team member invitations with email delivery via Resend (console fallback in development).
- Custom domain routing and verification for workspaces.
- Link editing and deletion APIs and UI (`ManageLinksDialog`).
- Document deletion with UploadThing storage cleanup.
- Analytics CSV export endpoint.
- Visual upload progress indicator during UploadThing uploads.
- Data retention cleanup cron endpoint (`/api/cron/cleanup`).
- Password reset flow (forgot/reset API routes and pages).
- Rate limiting and input validation for public viewer endpoints.
- Redis-backed rate limiter with in-memory fallback for single-instance deployments.
- Database indexes on analytics-related tables (`share_links`, `view_sessions`, `page_views`).
- Real-time analytics dashboard with 5-second auto-refresh and live indicator.
- Visibility-aware viewer heartbeat to avoid inflating duration when the tab is hidden.
- Centralized analytics aggregation helper (`lib/analytics.ts`) with unit tests.
- Health check endpoint (`/api/health`) with database and UploadThing checks.
- Production `Dockerfile` and `docker-compose.prod.yml` with PostgreSQL, Redis, and app services.
- Security response headers including CSP, HSTS, X-Frame-Options, and Referrer-Policy.
- GitHub Actions CI workflow with lint, type-check, unit tests, build, and Playwright E2E tests.
- Sentry error tracking scaffold (enabled when `NEXT_PUBLIC_SENTRY_DSN` is set).
- Playwright E2E test suite covering authentication and viewer access control.
- PostgreSQL backup/restore scripts and Docker Compose backup sidecar.
- Disaster recovery runbook (`docs/disaster-recovery.md`).
- Vitest test framework and 51 automated tests covering auth, domains, email, rate limiting, invites, shares, documents, analytics, cron, password reset, viewer verify, and health.
- GitHub pull request template.

### Changed

- Stabilized infrastructure on Prisma 5.22, Tailwind CSS v3, and shadcn/ui tokens.

### Fixed

- Team invite copy-to-clipboard now uses the secure `token` instead of the raw `id`.
- `.env.example` now documents `NEXT_PUBLIC_APP_DOMAIN`, `CUSTOM_DOMAIN_CNAME_TARGET`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, and `CRON_SECRET`.

### Security

- Viewer tokens enforce access control and prevent direct storage URL exposure.
- Production-grade security hardening and PRD consistency review.

[Unreleased]: https://github.com/OpenCore-Hub/PaperTrail/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/OpenCore-Hub/PaperTrail/compare/v0.1.0...v0.2.0
