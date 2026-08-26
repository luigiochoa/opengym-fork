#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "Uso: $0 <client-id>" >&2
  exit 1
fi
if [[ ! "$ID" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "client-id: solo minúsculas, números y guiones" >&2
  exit 1
fi
DEST="$ROOT/pack/clients/$ID"
if [[ -e "$DEST" ]]; then
  echo "Ya existe $DEST" >&2
  exit 1
fi
cp -R "$ROOT/pack/clients/_template" "$DEST"
# Rewrite placeholders
if command -v python3 >/dev/null 2>&1; then
  python3 - <<PY
from pathlib import Path
dest = Path("$DEST")
cid = "$ID"
title = cid.replace("-", " ").title()
brand = dest / "branding.json"
b = brand.read_text()
b = b.replace("CLIENT_ID", cid).replace("Nombre del Gym", title)
brand.write_text(b)
print(f"Creado pack/clients/{cid} ({title})")
print("Edita branding.json y assets/logo.svg|png; luego: ./pack/scripts/apply-brand.sh", cid)
PY
else
  echo "Creado $DEST — edita a mano CLIENT_ID / Nombre del Gym"
fi
