# Este repositorio es un fork de openGym

**Upstream:** [github.com/DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)
**Licencia del código:** GNU AGPL v3.0 (ver [LICENSE](LICENSE) y [NOTICE.md](NOTICE.md))

## Remotes Git

| Remote | Uso |
|--------|-----|
| `upstream` | Proyecto original (pull de mejoras) |
| `origin` | Tu fork público: `https://github.com/luigiochoa/opengym-fork` |

```bash
git remote set-url origin https://github.com/luigiochoa/opengym-fork.git
git push -u origin main
```

`upstream` apunta a GitHub. Base de esta actualización: **v1.4.2**. Guía de operación y recuperación: [pack/PILOT.md](pack/PILOT.md).

**Demo en GitHub Pages** (opcional, ya activado): https://luigiochoa.github.io/opengym-fork/
Si el workflow de Pages falla en un repo nuevo, activa Pages una vez en *Settings → Pages → Source: GitHub Actions*.
## Cumplimiento AGPL (obligatorio)

Si ofreces esta app modificada como servicio en red a un gimnasio (hosting o SaaS):

1. El código fuente correspondiente debe estar disponible bajo AGPL (repo público o oferta escrita a cada cliente).
2. Conserva LICENSE, NOTICE.md y la atribución a openGym / Duarte Santos.
3. En Settings, el pie muestra el enlace `VITE_SOURCE_URL` (tu fork) y “based on openGym”.
4. El catálogo v1.4.2 incluye medios con licencia separada: conservar NOTICE.md y obtener derechos propios antes de distribuirlos comercialmente. El GIF local de hip thrust es temporal.

Detalle operativo: [pack/AGPL_COMPLIANCE.md](pack/AGPL_COMPLIANCE.md).

## Pack comercial (MVP)

Plantillas por cliente, white-label y checklist de entrega: carpeta **[pack/](pack/)**.

## Producto propio (paralelo, sin código AGPL)

El monorepo cerrado vive en el directorio hermano:

`../gym-local` → `/Users/luigiochoa/Documents/Cursor/gym-local`

No copies archivos de este fork allí. Roadmap ops: [pack/ROADMAP_OPS.md](pack/ROADMAP_OPS.md).
