# Checklist de prueba — Fortachones Gym (MVP)

## Objetivo
Probar la app como dueño y como socio, para saber si el “pack app del gym” sirve para vender.

## Antes de empezar

- App en el móvil: https://fortachones.luigiochoa.com (añadir a pantalla de inicio)
- Código de invitación para dueño: `FORTA001` (ya usado)
- Perfil admin: **Luigi** → panel de admin para generar códigos

---

## Prueba 1 — Crea tu primer plan (dueño)

1. Abre la app
2. Toque **Plan** en la barra inferior
3. Pulsa **+** o **Nueva rutina**
4. Crea una rutina, ej:
   - **Empuje (Lunes)**
     - Press banca: 3 series × 8-10 reps
     - Press hombros: 3 × 10-12
     - Fondos: 3 × fallo
5. Toca **Añadir al plan** y asigna a **Lunes**
6. Repite para **Miércoles (Tirón)** y **Viernes (Pierna)**

Pregunta a responder: ¿Es rápido crear 3 rutinas? ¿Falta algo?

---

## Prueba 2 — Hacer un entrenamiento

1. Ve a **Inicio** / **Home**
2. Toca el día (hoy) si tiene rutina asignada
3. Toca **Empezar entreno**
4. Registra peso y repeticiones en cada serie
5. Toca el temporizador de descanso entre series
6. Al finalizar, revisa el resumen (PRs, volumen, etc.)

Pregunta a responder: ¿El flujo de entreno se entiende en móvil? ¿Los pesos se prellenan bien?

---

## Prueba 3 — Peso corporal y estadísticas

1. Desde **Inicio**, pulsa tu peso actual
2. Registra 2–3 pesos distintos (pueden ser ficticios para probar)
3. Ve a **Stats** → gráfica de peso
4. Explora: heatmap, mapa muscular, PRs

Pregunta a responder: ¿Las gráficas motivan? ¿Qué mostrarías a un socio?

---

## Prueba 4 — Invitar a un socio (admin)

1. Ve a **Ajustes**
2. Toca **Panel de administración**
3. Toca **Invitar**
4. Copia el código generado (ej. `FORTA00X`)
5. Envíalo por WhatsApp a alguien de confianza
6. Pídele que:
   - Abra la URL
   - Toca **Crear perfil**
   - Ponga el código
   - Use passkey (Face ID / huella)
7. Pídele que haga un entreno de prueba

Pregunta a responder: ¿El socio entiende el flujo de invitación? ¿Se tarda más de 2 minutos?

---

## Prueba 5 — Marca / identidad visual

1. Abre la app y fíjate en:
   - Logo en login
   - Nombre “Fortachones Gym”
   - Color verde
   - Tagline “Conoce tu mejor versión”
2. Comparte screenshot a alguien y pregúntale: *“¿Parece app de un gym?”*

Pregunta a responder: ¿La marca del gym se siente?

---

## Preguntas clave para tomar decisión

| # | Pregunta | Sí / No / Nota |
|---|----------|----------------|
| 1 | ¿Te animaría a entrenar con esta app? | |
| 2 | ¿Un socio sin conocimientos técnicos la usaría? | |
| 3 | ¿Te da vergüenza (en buen sentido) mostrarla al gym? | |
| 4 | ¿Falta algo indispensable para vender el pack? | |
| 5 | ¿Qué cambiarías antes de ofrecerla a un gym real? | |

---

## Feedback para recoger de los socios

- ¿Entendiste el login con passkey?
- ¿Te fue fácil crear el perfil?
- ¿Te gustaría que el gym tuviera esto?
- ¿Prefieres que sea solo la app, o también para pagos/reservas?

---

## Siguientes pasos según el resultado

| Si el feedback es… | Acción |
|--------------------|--------|
| Positivo | Preparar one-pager comercial y precio del pack |
| Más funciones (pagos, reservas, coaches) | Iniciar producto propio `gym-local` |
| Marca débil | Mejorar logo, onboarding, screenshots |
| Confuso | Simplificar flujo / instrucciones iniciales |

---

## Notas

- MVP = tracker personal con marca del gym. No incluye pagos, reservas, membresías.
- La media (GIF) sigue siendo del dataset de openGym hasta que se sustituya por assets propios.
- Backup de datos: carpeta `data/` del VPS (/opt/opengym-fortachones/data/).
