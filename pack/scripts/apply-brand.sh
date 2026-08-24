#!/usr/bin/env bash
# Apply a pack client branding to the repo root (.env + optional logo) for docker compose build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLIENT="${1:-}"
if [[ -z "$CLIENT" ]]; then
  echo "Uso: $0 <client-id>" >&2
  echo "Clientes:" >&2
  ls -1 "$ROOT/pack/clients" | grep -v '^_' >&2 || true
  exit 1
fi
DIR="$ROOT/pack/clients/$CLIENT"
if [[ ! -d "$DIR" ]]; then
  echo "No existe pack/clients/$CLIENT" >&2
  exit 1
fi

cp "$DIR/.env" "$ROOT/.env"
echo "→ .env desde pack/clients/$CLIENT/.env"

BRAND="$DIR/branding.json"
if [[ -f "$BRAND" ]] && command -v python3 >/dev/null 2>&1; then
  # Sync VITE_* from branding.json into .env (keeps RP_ID/ORIGIN/ADMIN from .env)
  python3 - <<'PY' "$BRAND" "$ROOT/.env"
import json, re, sys
brand_path, env_path = sys.argv[1], sys.argv[2]
b = json.load(open(brand_path))
updates = {
  "RP_NAME": b.get("rpName") or b.get("appName"),
  "VITE_APP_NAME": b.get("appName"),
  "VITE_APP_DESCRIPTION": b.get("appDescription"),
  "VITE_DEFAULT_ACCENT": b.get("accent"),
  "VITE_BRAND_TAGLINE": b.get("tagline") or "",
  "VITE_BRAND_LOGO": "1" if b.get("useLogo") else "",
  "VITE_SOURCE_URL": b.get("sourceUrl"),
}
text = open(env_path).read()
for k, v in updates.items():
  if v is None: continue
  if re.search(rf"^{k}=", text, re.M):
    text = re.sub(rf"^{k}=.*$", f"{k}={v}", text, count=1, flags=re.M)
  else:
    text += f"\n{k}={v}\n"
open(env_path, "w").write(text)
print("→ .env sincronizado con branding.json")
PY
fi

LOGO_SRC=""
for cand in "$DIR/assets/logo.png" "$DIR/assets/logo.jpg" "$DIR/assets/logo.webp"; do
  if [[ -f "$cand" ]]; then LOGO_SRC="$cand"; break; fi
done
PUBLIC="$ROOT/frontend/public"
mkdir -p "$PUBLIC"
if [[ -n "$LOGO_SRC" ]]; then
  cp "$LOGO_SRC" "$PUBLIC/brand-logo.png"
  echo "→ logo → frontend/public/brand-logo.png"
else
  rm -f "$PUBLIC/brand-logo.png"
  # Ensure VITE_BRAND_LOGO is off if no file
  if grep -q '^VITE_BRAND_LOGO=1' "$ROOT/.env" 2>/dev/null; then
    echo "Aviso: useLogo/VITE_BRAND_LOGO=1 pero no hay assets/logo.png — quita el flag o añade logo." >&2
  fi
fi

# Patch PWA manifest name for local/dev consistency (Docker build also gets title via Vite)
if [[ -f "$BRAND" ]] && command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY' "$BRAND" "$ROOT/frontend/public/manifest.json"
import json, sys
b = json.load(open(sys.argv[1]))
path = sys.argv[2]
m = json.load(open(path))
name = b.get("appName") or m.get("name")
m["name"] = name
m["short_name"] = name[:12]
m["description"] = b.get("appDescription") or m.get("description")
json.dump(m, open(path, "w"), indent=2)
open(path, "a").write("\n")
print("→ manifest.json actualizado")
PY
fi

echo "Listo. Rebuild: docker compose up -d --build"
echo "Fuente AGPL: revisa VITE_SOURCE_URL en .env y pack/AGPL_COMPLIANCE.md"
