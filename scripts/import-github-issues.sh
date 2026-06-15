#!/bin/bash
set -euo pipefail

REPO="OpenCore-Hub/PaperTrail"

if ! gh auth status >/dev/null 2>&1; then
  echo "请先运行 'gh auth login' 完成认证，再执行本脚本。"
  exit 1
fi

cd "$(dirname "$0")/.."

# 确保标签存在
for label in v0.3 v0.4 v0.5 backlog; do
  gh label create --repo "$REPO" "$label" --color "${label//v/}" --force >/dev/null 2>&1 || true
done

for file in tasks/issues/issue-*.md; do
  title=$(head -n1 "$file" | sed 's/^# //')
  label="backlog"
  if [[ "$file" == *"v0.3"* ]]; then label="v0.3"; fi
  if [[ "$file" == *"v0.4"* ]]; then label="v0.4"; fi
  if [[ "$file" == *"v0.5"* ]]; then label="v0.5"; fi

  echo "Creating: $title"
  gh issue create --repo "$REPO" --title "$title" --body-file "$file" --label "$label" || true
done

echo "Done."
