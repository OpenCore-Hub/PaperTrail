#!/usr/bin/env sh
set -e

# Entrypoint for the docker-compose backup sidecar.
# Schedules backup-db.sh via busybox crond.

BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 3 * * *}"

mkdir -p /var/log
touch /var/log/cron.log

echo "$BACKUP_SCHEDULE /usr/local/bin/backup-db.sh >> /var/log/cron.log 2>&1" | crontab -

echo "Backup scheduler starting with schedule: $BACKUP_SCHEDULE"
exec crond -f -l 2
