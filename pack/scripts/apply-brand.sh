#!/usr/bin/env bash
# Apply one client's branding without replacing runtime/server configuration.
#
# .env is the instance config and survives deploys (domain, port, admins, etc.).
# branding.json is the brand source of truth. This script only updates RP_NAME,
# INVITE_PREFIX and VITE_* branding keys, then copies generated frontend assets.
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

BRAND="$DIR/branding.json"
if [[ ! -f "$BRAND" ]]; then
  echo "Falta $BRAND" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Se necesita python3 para aplicar branding." >&2
  exit 1
fi

ENV_FILE="$ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/pack/runtime/local.env.example" "$ENV_FILE"
  echo "→ .env creado desde pack/runtime/local.env.example"
else
  echo "→ .env existente preservado (dominio, puerto, admin y secretos)"
fi

# Only brand-owned keys are updated. Runtime keys are deliberately untouched.
python3 - <<'PY' "$BRAND" "$ENV_FILE"
import json, re, sys
brand_path, env_path = sys.argv[1], sys.argv[2]
b = json.load(open(brand_path))
updates = {
  "RP_NAME": b.get("rpName") or b.get("appName"),
  "INVITE_PREFIX": b.get("invitePrefix") or "",
  "VITE_APP_NAME": b.get("appName"),
  "VITE_APP_DESCRIPTION": b.get("appDescription"),
  "VITE_DEFAULT_ACCENT": b.get("accent"),
  "VITE_DEFAULT_LANG": b.get("lang") or "en",
  "VITE_BRAND_ACCENT": b.get("accentHex") or "",
  "VITE_BRAND_TAGLINE": b.get("tagline") or "",
  "VITE_BRAND_INSTAGRAM": b.get("instagram") or "",
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

PUBLIC="$ROOT/frontend/public"
mkdir -p "$PUBLIC"
rm -f "$PUBLIC/brand-logo.svg" "$PUBLIC/brand-logo.png"
LOGO_URL=""
# Prefer SVG (transparent mark for login); keep PNG as PWA / fallback if present.
if [[ -f "$DIR/assets/logo.svg" ]]; then
  cp "$DIR/assets/logo.svg" "$PUBLIC/brand-logo.svg"
  LOGO_URL="./brand-logo.svg"
  echo "→ logo SVG → frontend/public/brand-logo.svg"
fi
if [[ -f "$DIR/assets/logo.png" ]]; then
  cp "$DIR/assets/logo.png" "$PUBLIC/brand-logo.png"
  echo "→ logo PNG → frontend/public/brand-logo.png"
  [[ -z "$LOGO_URL" ]] && LOGO_URL="./brand-logo.png"
elif [[ -f "$DIR/assets/logo.jpg" ]]; then
  cp "$DIR/assets/logo.jpg" "$PUBLIC/brand-logo.png"
  LOGO_URL="./brand-logo.png"
  echo "→ logo JPG → frontend/public/brand-logo.png"
elif [[ -f "$DIR/assets/logo.webp" ]]; then
  cp "$DIR/assets/logo.webp" "$PUBLIC/brand-logo.png"
  LOGO_URL="./brand-logo.png"
  echo "→ logo WEBP → frontend/public/brand-logo.png"
fi
if [[ -n "$LOGO_URL" ]]; then
  if grep -q '^VITE_BRAND_LOGO_SRC=' "$ROOT/.env" 2>/dev/null; then
    sed -i.bak "s|^VITE_BRAND_LOGO_SRC=.*|VITE_BRAND_LOGO_SRC=$LOGO_URL|" "$ROOT/.env" && rm -f "$ROOT/.env.bak"
  else
    echo "VITE_BRAND_LOGO_SRC=$LOGO_URL" >> "$ROOT/.env"
  fi
elif grep -q '^VITE_BRAND_LOGO=1' "$ROOT/.env" 2>/dev/null; then
  echo "Aviso: useLogo/VITE_BRAND_LOGO=1 pero no hay assets/logo.svg ni logo.png." >&2
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
short = b.get("shortName") or (name.split()[0] if name else "App")
m["short_name"] = short[:12]
m["description"] = b.get("appDescription") or m.get("description")
hex_acc = b.get("accentHex")
if hex_acc and hex_acc.startswith("#"):
    m["theme_color"] = hex_acc
    m["background_color"] = "#000000"
json.dump(m, open(path, "w"), indent=2)
open(path, "a").write("\n")
print("→ manifest.json actualizado")
PY
fi

# PWA / home-screen icons (client assets override defaults)
for size in 180 512; do
  src="$DIR/assets/icon-${size}.png"
  if [[ -f "$src" ]]; then
    cp "$src" "$PUBLIC/icon-${size}.png"
    echo "→ icon-${size}.png"
  fi
done

# Custom exercise media (e.g. ts-hip-thrust.gif) — served from /gif/ and /img/ like EXDB.
EX_ASSETS="$DIR/assets/exercises"
if [[ -d "$EX_ASSETS" ]] && ls "$EX_ASSETS"/*.gif >/dev/null 2>&1; then
  mkdir -p "$PUBLIC/gif" "$PUBLIC/img" "$ROOT/media/gif" "$ROOT/media/img"
  for f in "$EX_ASSETS"/*.gif; do
    base="$(basename "$f")"
    cp "$f" "$PUBLIC/gif/$base"
    cp "$f" "$PUBLIC/img/$base"
    cp "$f" "$ROOT/media/gif/$base"
    cp "$f" "$ROOT/media/img/$base"
    echo "→ ejercicio custom: $base → gif/ + img/"
  done
fi

echo "Listo. Rebuild: docker compose up -d --build"
echo "Fuente AGPL: revisa VITE_SOURCE_URL en .env y pack/AGPL_COMPLIANCE.md"
