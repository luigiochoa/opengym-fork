# Legs Day · Team Sarmiento

## De dónde salen los GIF

Fortachones (openGym) usa el catálogo **ExerciseDB v1** redistribuido en
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (MIT metadata).

Las animaciones son archivos **Gym Visual / ExerciseDB** servidos en producción desde:

- `/gif/{exerciseId}-{hash}.gif`
- `/img/{exerciseId}-{hash}.jpg`

Se descargan al desplegar el VPS (~140 MB). **No** vienen de gym-local ni de assets propios.

Ver `NOTICE.md` en la raíz del repo (licencia de metadata vs media).

## Hip thrust — el de la hoja del coach

La hoja de Team Sarmiento usa **hip thrust en máquina con disco** (como en el GIF azul de Gym Visual que conoces).

Ese ejercicio **no está** en ExerciseDB con ese nombre ni con esa máquina. En el catálogo solo hay, por ejemplo:

| Nombre en catálogo | ¿Es el de la hoja? |
|--------------------|-------------------|
| barbell glute bridge | No — es con barra en el suelo/banco |
| resistance band hip thrusts on knees | No |
| lever hip extension v. 2 | No — otra máquina (extensión hacia atrás) |

Por eso en la rutina cargable usamos un **ejercicio personalizado** `Hip thrust` (`ts-hip-thrust`):

- Nombre correcto para el socio
- Peso 27.5 kg precargado
- GIF temporal en `pack/clients/fortachones-gym/assets/exercises/ts-hip-thrust.gif` (máquina plate-loaded; watermark Gym Visual — **uso temporal** hasta licencia formal)

## Resto de ejercicios (sí tienen GIF del catálogo)

| # | Hoja coach | EXDB | ID |
|---|------------|------|-----|
| 1 | Adducción de cadera | lever seated hip adduction | `0598` |
| 2 | Hip thrust máquina | custom + GIF cliente | `ts-hip-thrust` |
| 3 | Hack lineal | sled hack squat | `0743` |
| 4 | Extensión cuádriceps | lever leg extension | `0585` |
| 5 | Curl femoral sentado | lever seated leg curl | `0599` |
| 6 | Pantorrilla | lever standing calf raise | `0605` |

## Cómo cargar

**Plan** o **Ajustes → Datos** → *Cargar Legs Day · Team Sarmiento*

## Media custom

`apply-brand.sh` copia `assets/exercises/*.gif` a `media/gif/`, `media/img/` y `frontend/public/` para que nginx los sirva igual que el catálogo EXDB.

## Futuro

Reemplazar el GIF temporal por:

1. Licencia Gym Visual / media propia, o
2. Entrada oficial en ExerciseDB, o
3. Arte propio en gym-local (repo en pausa).
