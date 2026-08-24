# Cumplimiento AGPL — pack comercial

Este fork hereda **GNU AGPL v3.0**. No es software propietario.

## Obligaciones mínimas al vender el pack

1. **Fuente disponible** — Mantén `origin` apuntando a un repositorio público del fork, o entrega a cada cliente un enlace/archivo con el código exacto que corre en su instancia (incluidas tus modificaciones white-label).
2. **Atribución** — No elimines LICENSE ni NOTICE.md. El pie de Settings ya enlaza tu `VITE_SOURCE_URL` y openGym upstream.
3. **Oferta de fuente** — En la entrega, incluye la sección “Código fuente” del checklist ([ENTREGA.md](ENTREGA.md)).
4. **Media de ejercicios** — openGym no relicensea imágenes/GIF. El compose las clona en runtime. No las empaquetes en un ZIP comercial ni las hospedes como “tuyas” sin acuerdo con el titular (ver NOTICE.md).
5. **Contrato** — Vende setup, hosting, marca y soporte; no vendas “licencia propietaria del código openGym”.

## Qué puedes cobrar

- Instalación / dominio / HTTPS / backups
- Personalización visual (logo, colores, nombre)
- Soporte y mantenimiento mensual
- Migración futura al producto propio (`gym-local`)

## Qué no puedes hacer

- Cerrar el código del servicio basado en este fork
- Mezclar estos archivos en el monorepo propietario `gym-local`
- Afirmar que el MVP incluye gestión de membresías/pagos (aún no)

## Contacto de fuente (plantilla)

> El software de seguimiento que opera en `https://TU_DOMINIO` es una modificación de openGym (AGPL-3.0). El código fuente correspondiente está en: `https://github.com/luigiochoa/opengym-fork`. Upstream: https://gitlab.com/DuarteSantos8/opengym
