# Media de ejercicios — estrategia (producto propio)

## Decisión actual (MVP fork)

El fork **sigue usando** el flujo de openGym: en el primer `docker compose up`, el servicio `media` descarga imágenes/GIF desde [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).

- **No** empaquetamos esos archivos en el repo ni en un ZIP comercial.
- **No** los revendemos como “nuestros”.
- Ver [NOTICE.md](../NOTICE.md) y [AGPL_COMPLIANCE.md](AGPL_COMPLIANCE.md).

El MVP white-label (Fortachones, etc.) valida marca + tracker; la media de terceros es deuda consciente hasta `gym-local`.

## Problema

| Capa | Licencia / estado |
|------|-------------------|
| Nombres, atributos, instrucciones (texto) | MIT vía dataset (usable con atribución) |
| Thumbnails JPG + animaciones GIF | **No** MIT ni AGPL — © Gym visual / disputa ExerciseDB; openGym no las relicensea |

Para un producto comercial propio, depender de esa media es un riesgo. Hay que sustituirla **antes** (o al mismo tiempo) que el tracker de `gym-local` salga a clientes de pago.

## Decisión para `gym-local` (cuando construyamos el producto propio)

**No recrear ~1.300 GIF.** Coste alto y riesgo de parecer “copia” del contenido de terceros.

**Sí: media propia, por categoría, tintada con el accent de cada gym.**

```
Ejercicio → grupo muscular / tipo → SVG (o ilustración) propia → color CSS var(--accent)
```

### Fase media 1 (mínimo viable en producto propio)

1. Apagar cualquier fetch de Gym visual / ExerciseDB media.
2. Set propio de **8–12 SVG** por categoría (press, pull, piernas, hombros, core, cardio, bodyweight, máquina, etc.).
3. UI de workout/library: si no hay media específica del ejercicio, mostrar la de categoría con el color de marca del tenant.
4. Mantener **instrucciones en texto** (propias o derivadas MIT con atribución).
5. Documentar en el one-pager: “ilustraciones propias; sin demos animadas de terceros”.

### Fase media 2 (opcional, post–validación)

- Lottie / SVG animado solo en los **30–50** ejercicios más usados.
- Iconos PWA por gym derivados del logo del cliente (ya tenemos SVG de marca).

### Fuera de alcance (salvo licencia pagada)

- Empaquetar o espejar los GIF actuales.
- “Rehacer” fotograma a fotograma las animaciones de Gym visual.
- Licenciar Gym visual solo si un cliente grande lo exige y paga el coste.

## Checklist al arrancar tracker en `gym-local`

- [ ] Ningún `docker`/CDN apunta a exercises-dataset media
- [ ] Assets en repo propio (`apps/web/public/exercise-art/` o similar) con licencia clara (tuyos)
- [ ] Tint por `tenant.branding.accent`
- [ ] Atribución de texto MIT si se reutilizan instrucciones del dataset
- [ ] Actualizar contrato / one-pager: media propia

## Relación con el fork

| Repo | Media ahora | Media objetivo |
|------|-------------|----------------|
| `opengym-fork` (MVP) | GIF via download en runtime | Sin cambio hasta migrar clientes |
| `gym-local` (propio) | N/A aún | SVG por categoría + accent |

Cuando un gym migre del fork → propio, deja de depender de esa descarga.
