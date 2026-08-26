# Arquitectura white-label

## Decisión

No se crea un fork de código por gimnasio.

```text
opengym-fork (core común)
├── frontend / api / Docker
├── pack/clients/demo
├── pack/clients/fortachones-gym
└── pack/clients/otro-gym

VPS Fortachones ── aplica client=fortachones-gym ── datos propios
VPS Otro Gym    ── aplica client=otro-gym        ── datos propios
```

`opengym-fork` es la fábrica white-label y cada carpeta bajo `pack/clients/`
es una configuración de marca. Cada despliegue conserva su propio `.env`,
`data/`, dominio, admins y backups.

## Cuándo sí separar un repositorio

Solo cuando un cliente pague por funcionalidad exclusiva que:

1. no deba llegar a los demás gimnasios; y
2. no pueda resolverse con configuración o feature flags.

Las mejoras generales (onboarding, UX, tracker, roles) se implementan una vez
en el core y benefician a todos los clientes.

## Fuentes de verdad

| Contenido | Fuente | Se versiona |
|-----------|--------|--------------|
| Código común | repositorio `opengym-fork` | Sí |
| Marca | `pack/clients/<id>/branding.json` y `assets/` | Sí |
| Infraestructura | `.env` de cada instancia | No |
| Usuarios/entrenos/passkeys públicas | `data/` de cada instancia | No; backup obligatorio |
| Media descargada | `media/` | No |

## Flujo de cambios

```text
Mac: editar + probar
  → GitHub: commit/push
    → VPS: deploy-client.sh <cliente> --pull
```

Nunca se edita código directamente en producción. `apply-brand.sh` solo cambia
variables de marca y **preserva** `RP_ID`, `ORIGIN`, `WEB_PORT`, `ADMIN_UIDS`
y demás configuración del servidor.

