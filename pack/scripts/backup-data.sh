#!/usr/bin/env bash
# Backup the instance data folder and prune old local archives.
# Usage: ./pack/scripts/backup-data.sh [backup-dir] [retention-days]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${1:-$ROOT/backups}"
RETENTION_DAYS="${2:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
INSTANCE="$(basename "$ROOT")"
ARCHIVE="$DEST/${INSTANCE}-data-${STAMP}.tar.gz"

if [[ ! -d "$ROOT/data" ]]; then
  echo "No existe $ROOT/data; no hay nada que respaldar." >&2
  exit 1
fi

mkdir -p "$DEST"
tar -C "$ROOT" -czf "$ARCHIVE" data
chmod 600 "$ARCHIVE"

# Archives are local safety copies. Production should also sync DEST off-VPS.
find "$DEST" -type f -name "${INSTANCE}-data-*.tar.gz" -mtime "+$RETENTION_DAYS" -delete

echo "✓ Backup: $ARCHIVE"
echo "  Retención local: $RETENTION_DAYS días"

