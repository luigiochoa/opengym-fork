# Pack inicial — openGym fork white-label

Empaqueta una instancia por gimnasio: marca, dominio, invite-only, checklist de entrega.

## Flujo rápido

```bash
# 1. Nuevo cliente desde la plantilla
./pack/scripts/new-client.sh mi-gym

# 2. Edita pack/clients/mi-gym/branding.json, .env y assets/logo.png

# 3. Aplica branding al árbol de build y arranca (rebuild web)
./pack/scripts/apply-brand.sh mi-gym
docker compose up -d --build
```

Cliente de demostración listo: **`pack/clients/demo`**.

```bash
./pack/scripts/apply-brand.sh demo
docker compose up -d --build
# → http://localhost:8080  (RP_NAME / UI: "Gym Demo")
```

## Qué incluye el pack (MVP)

| Incluye | No incluye (producto propio después) |
|---------|--------------------------------------|
| Tracker de socios (rutinas, series, peso) | Membresías / pagos |
| Marca: nombre, tagline, acento, logo opcional | Clases y reservas |
| Invite-only + admin del dueño | Check-in / torniquete |
| 1 instancia Docker por gym | Multi-tenant SaaS cerrado |

## Estructura

```
pack/
  AGPL_COMPLIANCE.md
  ENTREGA.md              # checklist de entrega al cliente
  ONE_PAGER.md            # qué vendes / qué no
  ROADMAP_OPS.md          # priorización fase ops
  clients/
    _template/            # base para new-client.sh
    demo/                 # cliente demo desplegable
  scripts/
    apply-brand.sh
    new-client.sh
```

## Variables de marca (build)

| Variable | Efecto |
|----------|--------|
| `VITE_APP_NAME` | Título UI, login, PWA title |
| `VITE_APP_DESCRIPTION` | meta description |
| `VITE_DEFAULT_ACCENT` | lime, sky, orange, violet, pink, red, teal, gold |
| `VITE_BRAND_TAGLINE` | Subtítulo bajo el nombre en login |
| `VITE_BRAND_LOGO=1` | Usa `frontend/public/brand-logo.png` |
| `VITE_SOURCE_URL` | Enlace “source code” (tu fork AGPL) |
| `RP_NAME` | Nombre en el prompt de passkey (runtime) |

Tras cambiar marca: **rebuild** del servicio `web` (`docker compose up -d --build`).
