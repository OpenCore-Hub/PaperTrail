#!/usr/bin/env bash
set -euo pipefail

# DocHub PostgreSQL restore script.
#
# Usage: ./scripts/restore-db.sh <backup-file.dump>
#
# Environment variables:
#   DATABASE_URL  (required) Target database connection string.

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.dump>" >&2
  exit 1
fi

BACKUP_FILE="$1"
: "${DATABASE_URL:?DATABASE_URL is required}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "WARNING: This will overwrite the database at:"
echo "  $DATABASE_URL"
read -r -p "Are you sure? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Restore cancelled."
  exit 0
fi

echo "Restoring from $BACKUP_FILE"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "$BACKUP_FILE"

echo "Running prisma migrate deploy to ensure schema is up to date"
npx prisma migrate deploy

echo "Restore complete."
