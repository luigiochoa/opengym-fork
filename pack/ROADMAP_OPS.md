# Roadmap ops (Fase 2+) — producto propio

Prioridad fija hasta que el feedback del MVP diga lo contrario. Implementar en **`gym-local`**, no en este fork AGPL.

## Orden

1. **Membresías** — planes, estado (activa / vencida / pausada), fechas, asignación socio↔plan  
2. **Clases / horarios** — plantilla semanal, cupos, inscripción del socio  
3. **Check-in** — registro de asistencia (QR o código), historial por socio  
4. **Pagos** — pasarela local (definir país), webhooks, estado de cuota  

## Criterios para subir de prioridad un ítem

- ≥3 clientes del pack MVP piden lo mismo de forma espontánea  
- Bloquea renovación del hosting mensual  
- Diferenciador claro vs. solo tracker  

## Fuera de alcance hasta tener 1–2 gyms pagando

- Torniquetes / hardware  
- App stores  
- Marketplace de coaches  
- IA de programación de rutinas  

## Migración desde el fork

Cuando `gym-local` tenga tracker básico + membresías:

1. Export JSON por perfil desde openGym (Settings → Export)  
2. Import en `gym-local` (mapeo de ejercicios best-effort)  
3. Apagar instancia fork tras validación  
4. Actualizar one-pager comercial  

Ver esqueleto: repositorio hermano `../gym-local`.
