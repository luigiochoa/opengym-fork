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
  # VPS checkouts contain generated brand assets. Resetting to origin/main is
  # intentional; source changes must be made locally and pushed first.
  git fetch origin main
  git reset --hard origin/main
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

