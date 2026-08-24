# Pack inicial — app de socios para tu gimnasio

## Qué es

Una **app con la marca de tu gym** para que los socios planifiquen rutinas, registren entrenamientos y sigan su progreso (peso corporal, series, PRs). Corre en **tu instancia** (o hosting gestionado): los datos no dependen de una red social fitness genérica.

Basado en software libre [openGym](https://gitlab.com/DuarteSantos8/opengym) (AGPL-3.0). El código fuente de la versión que usas está disponible según esa licencia.

## Qué incluye el pack

- App web instalable (PWA) con nombre, colores y logo de tu gym
- Perfiles con passkey (Face ID / huella) — sin contraseñas
- Solo socios invitados (códigos de invitación)
- Panel admin básico (usuarios, invitaciones, actividad)
- Puesta en marcha: dominio HTTPS, Docker, backup de datos
- Soporte inicial (definir días en el contrato)

## Qué no incluye (aún)

- Cobro de membresías ni pasarela de pagos
- Horarios de clases ni reservas
- Control de acceso / check-in en puerta
- App nativa obligatoria en App Store / Play (la PWA cubre el día a día)

Esas piezas llegan en el **producto propio** de gestión; el pack MVP valida la app de socios primero.

## Cómo se entrega

1. Configuramos marca y dominio  
2. Desplegamos la instancia  
3. Creas tu perfil admin y generas invitaciones  
4. Recibes checklist de backup + enlace al código fuente  

## Modelo

- **Pack inicial:** setup + marca + puesta en marcha + soporte de arranque  
- **Opcional:** hosting y mantenimiento mensual  
- **Upgrade futuro:** migración a plataforma completa (membresías, clases, pagos)
