# DocHub

DocSend-like document sharing and analytics SaaS. Upload PDFs, create tracked share links with password/expiration/email gate, and view detailed engagement analytics.

## Tech stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- NextAuth.js (credentials)
- UploadThing (PDF storage)
- Recharts (analytics charts)

## Getting started

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env
```

Update `.env` with your UploadThing token from [uploadthing.com](https://uploadthing.com).

### 3. Set up the database

```bash
npm run db:generate
npm run db:migrate
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up to create your workspace.

## Core features

- PDF upload (up to 20MB)
- Tracked share links with password, expiration, and email gate
- Secure viewer page with access control
- Real-time analytics: views, unique viewers, total/average time
- Workspace isolation

## Project structure

- `app/` — Next.js App Router pages and API routes
- `components/` — React components
- `lib/` — Utilities, Prisma client, auth config, upload config
- `prisma/` — Database schema and migrations
- `tasks/prd-dochub.md` — Product Requirements Document
