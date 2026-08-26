# Pack inicial — openGym fork white-label

Empaqueta una instancia por gimnasio: marca, dominio, invite-only, checklist de entrega.

Arquitectura: **un core común + configuración por cliente**, no un fork de
código por gimnasio. Ver [ARCHITECTURE.md](ARCHITECTURE.md).

## Flujo rápido

```bash
# 1. Nuevo cliente desde la plantilla
./pack/scripts/new-client.sh mi-gym

# 2. Edita pack/clients/mi-gym/branding.json y assets/logo.svg|png

# 3. Configura el runtime local una sola vez
cp pack/runtime/local.env.example .env

# 4. Aplica branding sin borrar runtime y arranca
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
  ARCHITECTURE.md          # core común vs. instancias por cliente
  MEDIA_STRATEGY.md       # salida de GIF de terceros → media propia en gym-local
  ENTREGA.md              # checklist de entrega al cliente
  ONE_PAGER.md            # qué vendes / qué no
  ROADMAP_OPS.md          # priorización fase ops
  clients/
    _template/            # base para new-client.sh
    demo/                 # cliente demo desplegable
  scripts/
    apply-brand.sh
    deploy-client.sh
    backup-data.sh
    new-client.sh
  runtime/
    local.env.example
    production.env.example
```

## Variables de marca (build)

| Variable | Efecto |
|----------|--------|
| `VITE_APP_NAME` | Título UI, login, PWA title |
| `VITE_APP_DESCRIPTION` | meta description |
| `VITE_DEFAULT_LANG` | Idioma por defecto (`es`, `en`, …) |
| `VITE_DEFAULT_ACCENT` | lime, sky, orange… o `brand` si hay hex |
| `VITE_BRAND_ACCENT` | Hex exacto de marca (ej. `#67C00A` del isotipo Fortachones) |
| `VITE_BRAND_TAGLINE` | Subtítulo bajo el nombre en login |
| `VITE_BRAND_LOGO=1` | Activa marca en login |
| `VITE_BRAND_LOGO_SRC` | Ruta del logo (`./brand-logo.svg` preferido, o `.png`) |
| `VITE_SOURCE_URL` | Enlace “source code” (tu fork AGPL) |
| `RP_NAME` | Nombre en el prompt de passkey (runtime) |

Tras cambiar marca: **rebuild** del servicio `web` (`docker compose up -d --build`).

## Producción

En el VPS, `.env` es infraestructura persistente. Se crea una vez desde
`pack/runtime/production.env.example` y no se versiona:

```bash
cp pack/runtime/production.env.example .env
# editar dominio, puerto y ADMIN_UIDS
./pack/scripts/deploy-client.sh fortachones-gym --pull
```

Backup manual:

```bash
./pack/scripts/backup-data.sh /opt/backups/opengym 14
```
