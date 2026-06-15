# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Document persistence refactor (ISSUE-001)**:
  - Storage abstraction layer (`IStorageProvider`, `UploadThingStorageProvider`, factory) with unit tests.
  - `DocumentVersion` model plus `StorageType` and `AiIndexStatus` enums; backfill migration for existing documents.
  - Upload, viewer, delete, and dashboard flows now read/write through `DocumentVersion`.
  - Version management API: `GET/POST /api/documents/[id]/versions` and `POST /api/documents/[id]/versions/[versionId]/set-latest`.
  - Structured audit logging helper (`lib/audit.ts`) wired to version lifecycle events.
- **AI infrastructure (ISSUE-004)**:
  - pgvector extension with `DocumentChunk`, `AiProviderConfig`, `AiConversation`, `AiMessage` models and HNSW index.
  - `IAiProvider` abstraction with `OpenAiProvider`, `AnthropicProvider`, and `OllamaProvider` implementations.
  - AES-256-GCM API key encryption for BYOK mode (`lib/ai/crypto.ts`).
  - PDF text extraction (`pdf-parse`) and token-aware chunking with page/paragraph metadata.
  - Lightweight AI indexing job queue (Redis + in-memory fallback) wired to upload/version creation.
  - Workspace AI settings API (`/api/workspaces/ai-config`) and UI page at `/dashboard/settings/ai`.
  - Reserved `POST /api/ai/extract` endpoint returning 501 until v0.4.
- Structured JSON logging via Pino (`lib/logger.ts`) for production observability.
- Sentry PII scrubbing (`token` query param) and release/environment configuration.
- New E2E tests for analytics dashboard (`e2e/analytics.spec.ts`) and team invitation flow (`e2e/team.spec.ts`).
- **PDF proxy cache** (`lib/pdf-cache.ts`): `/api/view/pdf` caches fetched PDFs on disk with configurable TTL, and the cleanup cron prunes expired entries.
- Unit tests for the PDF cache (`lib/__tests__/pdf-cache.test.ts`).

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
