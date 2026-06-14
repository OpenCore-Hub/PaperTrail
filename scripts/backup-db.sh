#!/usr/bin/env bash
set -euo pipefail

# DocHub PostgreSQL backup script.
#
# Environment variables:
#   DATABASE_URL            (required) PostgreSQL connection string.
#   BACKUP_DIR              (default: ./backups) Where to store dumps.
#   BACKUP_RETENTION_DAYS   (default: 7) Local backups older than this are deleted.
#   S3_BACKUP_BUCKET        (optional) If set, also sync BACKUP_DIR to this S3 bucket.

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="dochub_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_PATH"
pg_dump -Fc --no-owner --no-privileges "$DATABASE_URL" > "$BACKUP_PATH"

# Portable file size check for macOS and Linux.
if command -v stat &> /dev/null; then
  FILE_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null || echo "unknown")
  echo "Backup complete: $BACKUP_PATH (${FILE_SIZE} bytes)"
else
  echo "Backup complete: $BACKUP_PATH"
fi

echo "Pruning local backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'dochub_*.dump' -mtime +"$RETENTION_DAYS" -delete

if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  if ! command -v aws &> /dev/null; then
    echo "aws CLI not found, skipping S3 sync" >&2
    exit 0
  fi
  echo "Syncing backups to s3://$S3_BACKUP_BUCKET"
  aws s3 sync "$BACKUP_DIR" "s3://$S3_BACKUP_BUCKET"
fi
