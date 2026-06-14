# DocHub Disaster Recovery

This document describes how to protect and recover DocHub data in production.

## What is backed up

DocHub stores all business-critical data in **PostgreSQL**:

- Workspaces, users, and invitations
- Documents and share links
- View sessions, page views, and analytics
- Custom domain and password-reset token records

Uploaded PDFs are stored in **UploadThing**. Their lifecycle is managed by
UploadThing; refer to your UploadThing dashboard for file-level backups and
retention policies.

## Backup strategy

- **Frequency:** Daily at 03:00 UTC (configurable via `BACKUP_SCHEDULE`).
- **Format:** `pg_dump` custom-format (`-Fc`) dump files.
- **Retention:** 7 days locally by default (configurable via `BACKUP_RETENTION_DAYS`).
- **Offsite:** Optional S3 sync via `S3_BACKUP_BUCKET` and the AWS CLI.

## Environment variables

```bash
DATABASE_URL=postgresql://...        # required for backup and restore
BACKUP_DIR=./backups                 # default
BACKUP_RETENTION_DAYS=7              # default
BACKUP_SCHEDULE="0 3 * * *"          # default cron expression
S3_BACKUP_BUCKET=my-dochub-backups   # optional
```

## Running a backup manually

### Docker Compose

```bash
docker-compose -f docker-compose.prod.yml exec backup /usr/local/bin/backup-db.sh
```

### Host with PostgreSQL client installed

```bash
DATABASE_URL=postgresql://... ./scripts/backup-db.sh
```

Backups are written to `BACKUP_DIR` (`./backups` by default).

## Scheduling backups

### Option 1: Docker Compose backup sidecar (recommended)

The `docker-compose.prod.yml` includes a `backup` service that runs the backup
script on the configured cron schedule. It starts automatically with the stack.

### Option 2: Host cron

```bash
# crontab -e
0 3 * * * cd /path/to/dochub && DATABASE_URL=postgresql://... ./scripts/backup-db.sh >> /var/log/dochub-backup.log 2>&1
```

### Option 3: Kubernetes CronJob

If running on Kubernetes, create a CronJob that uses the `postgres:15-alpine`
image, mounts the backup script, and runs it on schedule.

## Restoring from a backup

> **Warning:** Restore overwrites the target database. Verify `DATABASE_URL`
> points to the correct database before proceeding.

```bash
# From a host with the PostgreSQL client installed
DATABASE_URL=postgresql://... ./scripts/restore-db.sh ./backups/dochub_20260115_030000.dump
```

The script will:

1. Drop existing objects (`--clean --if-exists`).
2. Restore schema and data.
3. Run `prisma migrate deploy` to bring the schema up to date.

After restoring, restart the DocHub application and verify `/api/health`.

## Verifying backups

A backup that has never been tested is not a backup. Schedule a regular restore
test to a non-production database:

```bash
# Restore to a separate verification database
DATABASE_URL=postgresql://.../dochub_verify ./scripts/restore-db.sh ./backups/dochub_20260115_030000.dump
```

Then run:

```bash
DATABASE_URL=postgresql://.../dochub_verify npx prisma db pull
```

## Failure scenarios

| Scenario | Mitigation | Recovery |
|---|---|---|
| Accidental row deletion | Daily backups | Restore to a new DB, extract needed rows, re-insert |
| Database corruption | Daily backups + offsite sync | Restore latest clean backup |
| Disk failure on app host | Stateless containers + DB backups | Rebuild host, restore DB from backup |
| UploadThing file loss | UploadThing retention / bucket versioning | Re-upload from local copy if available |
| Total environment loss | Offsite S3 backups | Provision new infra, restore DB, reconfigure env |

## RTO / RPO targets

These are suggested targets; adjust to your SLA:

- **RPO (Recovery Point Objective):** 24 hours (daily backups).
- **RTO (Recovery Time Objective):** 1 hour (restore DB + redeploy app).

To improve RPO, increase backup frequency or enable PostgreSQL continuous
archiving (WAL-E, pgBackRest, etc.).
