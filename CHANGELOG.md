# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Health check endpoint (`/api/health`) with database and UploadThing checks.
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
