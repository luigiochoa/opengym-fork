# Piloto: un entrenador y sus alumnos

Base integrada: **openGym v1.4.2**. `gym-local` no participa en esta POC.
La pantalla **Mis alumnos** es para el entrenador humano; el Coach de IA del original es otra función y no hace falta configurarlo.

## Probar localmente sin servidor

Desde la raíz del repositorio, instalar una vez:

```bash
npm ci --ignore-scripts --omit=optional --prefix api
npm ci --ignore-scripts --prefix frontend
npm run pilot:local
```

Abrir **http://localhost:5174** y elegir **Iniciar sesión con contraseña**. El iniciador muestra la contraseña de los perfiles ficticios **Entrenador**, **Ana** y **Bea**. Para cambiar de rol, cerrar sesión o usar una ventana privada. Los datos de prueba se conservan en `work/local-pilot/`; no utiliza el `.env` ni los datos de producción. La web y la API escuchan solo en el equipo local. Detener con Ctrl+C y volver a iniciar con el mismo comando conserva la prueba. Se pueden cambiar los puertos con `PILOT_WEB_PORT` y `PILOT_API_PORT`.

## Preparar una instancia

1. Trabajar sobre esta rama en una copia dedicada. Conservar el dominio y el directorio `data/` de la instancia existente: las passkeys dependen de `RP_ID` y `ORIGIN`.
2. Respaldar **con la API detenida**: `docker compose stop api`, `bash pack/scripts/backup-data.sh`, `docker compose start api`. Guardar el archivo fuera del servidor.
3. En `.env`, preservar la configuración existente y activar `TRAINER_PILOT=1`, `INVITE_ONLY=1`, `ALLOW_GUEST=0`, `DEFAULT_LANG=es`. Opcional: `PASSWORD_LOGIN=1` permite acceso con contraseña además de passkeys. La plantilla `pack/runtime/pilot.env.example` es para una instalación nueva, no para sobrescribir la existente.
4. Configurar `ADMIN_UIDS` con el ID de la cuenta del entrenador existente. El propietario de la instancia es el único que accede a **Mis alumnos**. No dar rol admin a alumnos.
5. En una instalación vacía: abrir solo en localhost o red privada, arrancar con `FIRST_USER_ADMIN=1` e `INVITE_ONLY=0`, registrar la cuenta del entrenador, anotar su ID desde Administración y volver a arrancar con `FIRST_USER_ADMIN=0`, `INVITE_ONLY=1` y `ADMIN_UIDS=<id>`. No exponer el registro abierto durante este proceso.
6. Aplicar marca: `bash pack/scripts/apply-brand.sh fortachones-gym`. Este paso conserva las variables de infraestructura.
7. Construir desde este código: `docker compose up -d --build`. No usar solamente `docker compose pull`: las imágenes oficiales no contienen las funciones de este fork.
8. Comprobar `/api/health`, acceso del entrenador, invitaciones, pantalla de alumnos y fuente AGPL en Ajustes.

La actualización incluye medios de ejercicios con licencia separada. Conservar los avisos y verificar los derechos del catálogo y del GIF temporal de hip thrust antes de ofrecer una distribución comercial; ver `NOTICE.md`.

## Recorrido del entrenador

- Inicio → **Mis alumnos** → **Invitaciones y accesos** para crear una invitación por alumno.
- Crear rutinas desde Plan y esperar a que se sincronicen.
- En **Mis alumnos**, elegir rutina, alumno y opcionalmente sus días; pulsar **Enviar rutina**. Los selectores usan los mismos paneles de la app.
- El alumno verá el plan al entrar en Inicio o volver a la app y deberá incorporarlo.
- Los días elegidos se actualizan; los demás días, las rutinas previas y el historial se conservan. Las asignaciones de varias rutinas se envían e incorporan una a una. Hay una asignación actual por alumno: enviar otra sustituye la tarjeta pendiente, no elimina lo ya incorporado.
- El estado **Recibida** se confirma únicamente después de que el plan esté sincronizado en el servidor. Una desconexión permite reintentar sin duplicar la rutina.
- El alumno registra su sesión en el tracker habitual. En Inicio, toca **Comentar al entrenador** (o **Tu comentario**) para escribir desde un panel y enviarlo.
- El entrenador ve última sesión, número de entrenamientos y estado del plan en la lista. Al tocar un alumno se abre su ficha con el comentario y las series registradas.

## Control manual de pagos

**Mis alumnos → tocar un alumno → Control de pagos → Registrar pago**.

El entrenador registra fecha de pago, inicio de cobertura y próxima renovación. El monto, método y nota son opcionales; se pueden registrar pagos sin monto. Los períodos sugeridos son un mes calendario, 15 días o 7 días, y la fecha se puede personalizar. Los meses cortos respetan su último día (31 de enero → 28/29 de febrero). Si el alumno paga antes de tiempo, el formulario propone comenzar la cobertura al finalizar el período actual.

Los estados son **Sin registro**, **Al día**, **Por vencer** (próximos siete días), **Vence hoy**, **Vencido** y **Programado**. La fecha de renovación es el día en que toca el siguiente pago. Un alumno sin registros no se considera vencido. Una cobertura pagada para el futuro no oculta un hueco vencido anterior. Las coberturas contiguas pagadas por adelantado se unen para calcular la próxima renovación.

En la lista se puede filtrar **Por renovar**. El resumen se actualiza al guardar, volver a la pantalla y mientras permanece visible. El día se calcula en el servidor con `TRAINER_TIMEZONE` (predeterminado `America/Caracas`). Mantener esta zona acorde al lugar de operación del entrenador.

El historial permanece en el servidor junto con los respaldos de la instancia. Tocar un pago permite **Anular registro**, con confirmación y recálculo de la renovación. La anulación conserva el registro; para corregir fechas o montos se anula y se registra la versión correcta. Los reintentos del mismo envío no crean duplicados.

El propietario registra y anula pagos. Cada alumno puede consultar únicamente sus propios pagos, fechas e importes desde **Inicio → Mis pagos**, sin editar el registro. Otros administradores no tienen acceso a la gestión de pagos. Las notas internas, identificadores del operador y claves de reintento nunca se envían al alumno. No procesa cobros ni bloquea el acceso al entrenamiento por vencimiento. No suma importes de monedas diferentes.

## Vista del alumno y recordatorios push

En **Inicio → Mis pagos**, cada alumno ve último pago, próxima renovación, estado e historial propios. La página funciona también antes de que el entrenador le asigne una rutina. Los registros anulados se indican, pero el alumno no puede anular ni modificar importes o fechas.

**Avisos de renovación** está apagado por defecto. Solo el alumno puede activarlo y elegir la hora. Se prepara un aviso durante los tres días anteriores y otro el día de renovación; no se repiten a diario ni se envían avisos a otros alumnos. Desactivarlo no apaga las notificaciones de entrenamiento. La hora usa la zona indicada en la página (Caracas por defecto).

En la POC HTTP local se guardan preferencias y se muestra el registro, pero el cliente existente no registra push sin HTTPS. Para recibir avisos reales, publicar la app con HTTPS, permitir notificaciones en un navegador compatible y activar el dispositivo desde **Mis pagos**. La UI distingue la preferencia guardada de un dispositivo registrado. No es necesario mantener la página abierta, pero la API sí debe estar funcionando.

El servidor revisa cada minuto, con hasta tres horas de recuperación después de la hora elegida y reintentos de fallos cada quince minutos. Guarda los avisos enviados para evitar duplicarlos tras reiniciar y vuelve a calcular la fecha si se registra o anula un pago. Sin pago registrado, sin suscripción push, sin permiso opt-in o con cuenta suspendida no envía avisos. En la pantalla bloqueada solo muestra un mensaje genérico, sin montos ni notas; al tocarlo abre la página de pagos, que exige iniciar sesión.

La lógica de envío está probada con un emisor simulado y las pruebas del transporte push existente. La entrega real en un teléfono queda pendiente de la instalación HTTPS y del permiso del usuario.

## Validación manual antes de invitar alumnos reales

Usar dos perfiles de prueba distintos y dos sesiones de navegador:

- [ ] El entrenador invita a ambos alumnos; un alumno no puede abrir `/trainer` ni Administración.
- [ ] Asignar Piernas al alumno A los lunes; B no recibe esa asignación.
- [ ] A incorpora el plan: se conserva su historial y el resto de su semana.
- [ ] A recarga y reintenta: la rutina no se duplica.
- [ ] A registra una sesión y un comentario; el entrenador ve ambos.
- [ ] Desconectar después de descargar la app, registrar series, reconectar y revisar la sincronización.
- [ ] Probar el acceso elegido en el teléfono real del piloto.
- [ ] Imprimir un plan: nombre/logo/color de Fortachones y atribución a openGym.
- [ ] El alumno abre Mis pagos y ve solo sus fechas e importes; las notas internas no aparecen.
- [ ] El alumno activa y desactiva sus avisos; cambiar de alumno no comparte la preferencia.
- [ ] En la instalación HTTPS, permitir push en un dispositivo y verificar recepción y apertura de Mis pagos.
- [ ] Exportar un perfil y restaurar el respaldo en una instancia separada.

## Recuperación

No iniciar la versión antigua contra un `data/` ya modificado por la versión nueva. Guardar el commit anterior (`bf313d40711bea03f24b6430780a86d5401e0cf9`) y el archivo de respaldo juntos.
Si se necesita volver: detener toda la instancia, mover el `data/` actual a una carpeta de resguardo, extraer el respaldo verificado que contiene `data/`, volver al commit anterior, aplicar marca y reconstruir. Probar primero en otra carpeta y puerto. Una vuelta atrás pierde los cambios posteriores al respaldo: conservar también la copia nueva para recuperarlos.

## Límites de esta POC

Una instancia, un entrenador propietario y sus alumnos. El propietario puede revisar sus historiales; no se han añadido varios entrenadores, cobros ni membresías. El feedback es una nota actual por alumno, no un chat. Las asignaciones y comentarios necesitan conexión; el tracker conserva la sincronización local del original. Las animaciones de ejercicios no se precargan todas para uso sin red. La aceptación conserva rutinas previas y sobrescribe solo los días seleccionados; no elimina automáticamente versiones anteriores de una rutina.


## Pedir ayuda durante el entrenamiento

El alumno encuentra **Pedir ayuda a mi entrenador** en Inicio y durante una sesión activa. Puede elegir asistencia con un ejercicio o una duda y añadir hasta 500 caracteres. Se guarda una solicitud actual por alumno en `db.json`; no se añade al historial de ejercicios del teléfono. Necesita conexión para enviarla.

El propietario ve **Solicitudes de ayuda** en Mis alumnos, ordenadas de más antigua a más reciente. **Voy a ayudarte** confirma recepción al alumno; **Marcar atendida** cierra la solicitud. Ambas pantallas consultan cambios cada diez segundos mientras están visibles. Otro alumno u otro administrador no pueden consultar ni atender estas solicitudes. Una solicitud pendiente no genera nuevos avisos al repetir el envío; tras cerrarla hay una espera mínima de un minuto desde el envío original.

Si el propietario tiene una suscripción push, se intenta enviar un aviso con el nombre del alumno y el motivo, sin incluir la nota. Al tocarlo abre Mis alumnos. El botón de activar avisos registra este dispositivo con permiso explícito y habilita las notificaciones generales de la app. En HTTP local se muestran solo los avisos dentro de la app. El push es un intento inmediato, sin garantía de entrega ni reintentos persistentes; la solicitud permanece disponible aunque falle el aviso. No hay chat ni seguimiento de ubicación.


### Refuerzos después de QA de asistencia

Los reintentos del mismo formulario conservan su identificador: si el entrenador ya atendió esa solicitud, el reintento devuelve el estado atendido y no genera otro aviso. Las consultas lentas no sobrescriben respuestas más recientes ni impiden mostrar resultados cuando la red tarda más de diez segundos. Al recuperar conexión se vuelve a consultar. El envío confirmado actualiza al alumno de inmediato. Un formulario abierto antes de cambiar de cuenta no puede enviarse con la cuenta nueva.

Un fallo de conexión conserva el detalle en el formulario y muestra una indicación en español para reintentar; el borrador no se garantiza tras cerrar o recargar la página. Las solicitudes muestran fecha y hora en el idioma de la app. Las pruebas cubren concurrencia, reinicio del servidor, aislamiento de cuentas, fallo de push y reversión cuando falla el guardado.


## Sesiones compartidas con el entrenador

En Inicio o en una sesión activa, el alumno puede activar **Compartir sesión con mi entrenador**. Está desactivado por defecto. La preferencia se guarda en `db.json`; el ejercicio, las series y el descanso se conservan solo en memoria de la API y no crean un historial de vigilancia.

En **Mis alumnos → Sesiones compartidas**, el propietario ve nombre del alumno, rutina, ejercicio seleccionado, series registradas y estado: sesión abierta, descanso con cuenta regresiva, descanso pausado o descanso terminado. La vista consulta cada cinco segundos. El alumno envía cambios del ejercicio, series o temporizador y una señal cada diez segundos mientras la sesión siga activa, aunque navegue a Inicio, Plan u otra pantalla. Se excluyen edición de sesiones guardadas y registro de entrenamientos pasados. El publicador vive en la raíz de la app y se detiene al terminar o descartar la sesión, apagar compartir o salir de la cuenta. Minimizar el entrenamiento no lo detiene.

Después de 35 segundos sin señal se indica **Sin señal reciente** y se conserva la última observación, con su hora, durante un máximo de cinco minutos. Luego desaparece. El final de una cuenta regresiva no significa que el alumno haya retomado una serie: se indica que el descanso terminó y se espera actualización. La actividad es aproximada según lo registrado en la app, no una medición de movimientos o repeticiones físicas. La suspensión de la app por el teléfono y la falta de conexión pueden interrumpir las señales.

Solo el propietario puede consultar esta vista. Otros alumnos y administradores no tienen acceso al detalle. Apagar el control retira la actividad del servidor y rechaza nuevas señales activas hasta volver a autorizarlo; la pantalla del entrenador refleja el cambio en su siguiente consulta. El reinicio de la API borra la actividad y la siguiente señal vuelve a publicarla. El contador de mensajes evita que una señal atrasada reemplace un estado más reciente o resucite una sesión cerrada.


### Teléfono bloqueado y suspensión de la web

Ocultar la app o bloquear el teléfono no se interpreta como terminar la sesión. Se intenta enviar una última observación con el ejercicio y el descanso; si el navegador sigue ejecutando la app, continúan las señales. Al volver a primer plano se envía una actualización inmediata. El indicador de falta de señal conserva su comportamiento: no se presenta una observación antigua como actividad en vivo.

La web no puede garantizar ejecución continua con el teléfono bloqueado. Los navegadores limitan los temporizadores de páginas ocultas y el sistema puede suspenderlas. La opción existente de mantener la pantalla encendida evita el apagado automático donde sea compatible; no fuerza el funcionamiento después de bloquear el teléfono manualmente. Documentación de referencia: [visibilidad y temporizadores](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). Se requiere validar el comportamiento en los teléfonos reales del piloto.


## Mejoras aplicadas después de la auditoría

La preferencia de compartir tiene una única fuente por alumno para el control y el publicador global. La consulta inicial se reintenta con esperas de 2, 4, 8, 16 y hasta 30 segundos, y al recuperar conexión o visibilidad. Un error inicial ya no exige recargar o alternar el control.

Asignación, confirmación y comentarios usan escrituras con reversión: si falla el disco, las consultas mantienen el estado previo. Al reemplazar una asignación se archiva la anterior; se conservan 50 versiones anteriores por alumno y 50 comentarios por versión. La historia anterior a esta función solo incluye la información que ya estaba guardada; no se inventan versiones perdidas. Propietario y alumno pueden consultar su historial; otros alumnos y administradores no.

La ayuda conserva hasta 256 identificadores de solicitudes aceptadas por alumno durante siete días. Reintentar una solicitud atendida, aunque haya otras posteriores, devuelve su estado anterior dentro de esa retención. Un formulario nuevo cuando ya existe ayuda pendiente devuelve conflicto con el estado actual, sin añadir escrituras ni avisos. El alumno puede cancelar una ayuda pendiente enviada por error; cuando el entrenador ya la está atendiendo, debe finalizarla el entrenador.

Mis alumnos reúne ayudas, renovaciones y rutinas pendientes de recepción. La ficha muestra días con entrenamientos guardados durante la semana frente a días de la rutina asignada; no implica que cada sesión haya completado esa rutina. Incluye exportación privada del historial de pagos en CSV, con protección frente a fórmulas en las notas. El alumno sigue viendo solo sus propios importes y fechas.

El listado utiliza resúmenes compactos en caché y agrupa pagos una sola vez. Los resúmenes se invalidan al sincronizar y detectan cambios del archivo, fecha o semana. El historial completo se consulta al abrir la ficha. Las pantallas secundarias se cargan bajo demanda.

## Operación de la versión web

Mantener el `RP_ID`, `ORIGIN`, clave de sesión y datos de la instalación existente para conservar accesos. El ejemplo de piloto usa `COACH_DISABLED=1` y permite combinar `docker-compose.yml` con `pack/runtime/compose.pilot.yml` para revisar salud cada 30 segundos. Detrás del proxy HTTPS, `WEB_BIND_ADDRESS=127.0.0.1` evita exponer directamente el puerto web. `APP_BUILD` identifica la compilación.

`deploy-client.sh` compila antes de interrumpir la API y respalda con las escrituras detenidas. Comprobar el respaldo con `python3 pack/scripts/check-backup.py ARCHIVO.tar.gz`; verifica estructura, JSON y permisos sin extraer o imprimir datos privados. Guardar también una copia privada fuera del servidor.

`python3 pack/scripts/pilot-status.py https://DOMINIO --data-dir data --backup-dir backups` informa de salud, bandera de piloto, espacio disponible y antigüedad del respaldo, sin identidades ni secretos. Es una comprobación a demanda, no instala una tarea programada.

### Validación en iPhone y Android

En iPhone, usar Safari, añadir la web a la pantalla de inicio y abrirla desde ese icono antes de activar notificaciones. El soporte Web Push requiere iOS 16.4 o posterior y permiso de la persona. Fuente: [WebKit](https://webkit.org/blog/13878/).

En Android, usar Chrome y permitir notificaciones para el sitio y para Chrome en el sistema. Se puede instalar la web como aplicación. Fuente: [Google Chrome](https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DAndroid&hl=es).

Probar cada sistema por separado: iniciar sesión, activar avisos en el perfil del entrenador, enviar una ayuda desde el alumno y confirmar su recepción con el teléfono del entrenador bloqueado. Después iniciar una sesión compartida, registrar una serie, minimizarla, bloquear y volver; comprobar que el descanso sigue coherente y que la interfaz distingue una señal reciente de una observación antigua. Finalizar o descartar debe retirar la actividad. La web no garantiza ejecución continua bajo bloqueo; el permiso de notificaciones no cambia esa limitación.
