#!/usr/bin/env bash
# Safe deployment from inside a client instance checkout.
# Usage: ./pack/scripts/deploy-client.sh fortachones-gym [--pull]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLIENT="${1:-}"
PULL="${2:-}"

if [[ -z "$CLIENT" ]]; then
  echo "Uso: $0 <client-id> [--pull]" >&2
  exit 1
fi
if [[ ! -f "$ROOT/.env" ]]; then
  echo "Falta $ROOT/.env. Copia pack/runtime/production.env.example y configúralo." >&2
  exit 1
fi

cd "$ROOT"

if [[ "$PULL" == "--pull" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Hay cambios locales. Revísalos antes de actualizar; no se borrarán automáticamente." >&2
    exit 1
  fi
  git fetch origin
  git merge --ff-only "@{upstream}"
fi

# Stop writes while taking a coherent backup. Restart the old API if backup fails.
if [[ -d "$ROOT/data" ]]; then
  docker compose stop api
  if ! bash "$ROOT/pack/scripts/backup-data.sh"; then
    docker compose start api
    exit 1
  fi
  docker compose start api
fi

"$ROOT/pack/scripts/apply-brand.sh" "$CLIENT"
docker compose up -d --build

PORT="$(awk -F= '/^WEB_PORT=/{print $2}' .env | tail -1)"
PORT="${PORT:-8080}"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    echo "✓ Cliente $CLIENT desplegado y saludable en puerto $PORT"
    docker compose ps
    exit 0
  fi
  sleep 2
done

echo "El stack arrancó, pero health no respondió en puerto $PORT." >&2
docker compose ps >&2
exit 1

