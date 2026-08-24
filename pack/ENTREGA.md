# Checklist de entrega — pack inicial

Cliente: _______________  
Dominio: _______________  
Fecha: _______________

## Pre-deploy

- [ ] Repo del fork público (o tarball de fuente listo para entregar)
- [ ] Cliente creado: `./pack/scripts/new-client.sh <id>`
- [ ] `branding.json` + logo (`assets/logo.png`, opcional)
- [ ] `.env` con `RP_ID` / `ORIGIN` HTTPS correctos
- [ ] `INVITE_ONLY=1` y `ALLOW_GUEST=0`
- [ ] `VITE_SOURCE_URL` apunta al fork público
- [ ] `./pack/scripts/apply-brand.sh <id>` ejecutado
- [ ] DNS A/AAAA o CNAME del dominio → servidor
- [ ] Proxy TLS (Caddy / Traefik / nginx / Cloudflare Tunnel) → `WEB_PORT`

## Deploy

- [ ] `docker compose up -d --build`
- [ ] Media de ejercicios descargada (servicio `media` OK; no se redistribuye en el pack)
- [ ] Abrir `ORIGIN` en el navegador; título = nombre del gym
- [ ] Crear perfil passkey del dueño
- [ ] Anotar `users[].id` de `./data/db.json` → poner en `ADMIN_UIDS` y recrear API/`docker compose up -d`
- [ ] Desde Admin: generar códigos de invitación para socios
- [ ] Probar login passkey en móvil (Safari/Chrome) sobre HTTPS

## Backups

- [ ] Cron o script diario que copie `./data` (y opcionalmente `./media` si quieres evitar re-descarga)
- [ ] Probar restore en staging una vez
- [ ] Documentar ubicación del backup al cliente (si self-host)

## Código fuente (AGPL)

- [ ] Entregar enlace al repo del fork **o** archivo fuente de esta versión
- [ ] Incluir texto de [AGPL_COMPLIANCE.md](AGPL_COMPLIANCE.md) en el acta / email de entrega
- [ ] Confirmar que LICENSE + NOTICE.md están en el repo entregado

## Handoff al cliente

- [ ] Credenciales/acceso al panel admin (passkey del dueño)
- [ ] Cómo invitar socios (Admin → invite codes)
- [ ] Cómo añadir a pantalla de inicio (PWA)
- [ ] Qué **no** incluye el pack (membresías, pagos, clases) — ver [ONE_PAGER.md](ONE_PAGER.md)
- [ ] Canal de soporte y ventana incluida (ej. 30–90 días)
- [ ] Acuerdo de hosting recurrente (si aplica)

## Post-entrega

- [ ] Snapshot de `git rev-parse HEAD` guardado junto al cliente
- [ ] Nota interna: feedback → [ROADMAP_OPS.md](ROADMAP_OPS.md) / producto `gym-local`
