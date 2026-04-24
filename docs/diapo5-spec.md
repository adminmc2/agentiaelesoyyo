# Diapo 5 — "Eres un profe ELITE" (v23.16)

Última actualización: v23.16.0 (2026-04-25)

## 1. Objetivo narrativo
Empoderar al profesor: sus agentes de IA serán tan ELITE como él/ella, porque lo que tiene el profe (pedagogía, MCER, lingüística ELE, errores por L1, empatía, cultura, estilo) es precisamente lo que un agente necesita. Se remata con el acrónimo ELITE explicado en sentido pedagógico y la invitación a sacar el agente que lleva dentro (comunidad Hablandis).

## 2. Hook
- Título: **"Eres un profe ELITE. Tus agentes lo serán también."** — `ELITE` resaltada con highlighter amarillo (`#C9A632` al 35%) que se anima al abrir (`scaleX(0 → 1)` en 0.9s con delay 600ms).
- Subtítulo: **"Lo que harán por ti · para ti · contigo."** — `por ti / para ti / contigo` en violeta profundo (`#6B2F6D`) bold.

## 3. Zonas (tras el hook, grid 2×2)
- **Zona A (top-left)** — "Tú sabes enseñar. Tú sabes de lengua. Tú conoces a tus alumnos." + label "Ingredientes que SOLO tú tienes" + **chip rotator** (ver §5).
- **Zona B (top-right)** — Focus cards: "Contigo, en clase" vs "Después, con tu alumno" + slogan "Construyes una vez. Se usa dos veces." con highlighter lavanda.
- **Zona C (bottom-left)** — Comunidad + QR Hablandis + orb de Eliana decorativo.
- **Zona D (bottom-right)** — Acrónimo ELITE stagger reveal.

## 4. Contenido textual (exacto)

### Zona A — chip rotator
Palabras (rotan cada 2.5s):
1. Pedagogía
2. Lingüística ELE
3. MCER
4. Errores por L1
5. Cultura
6. Empatía
7. Tu estilo

### Zona B — focus cards
**Card izquierda — "Contigo, en clase"** (icon: `ph-chalkboard-teacher`)
- Genera el quiz del texto que subiste.
- Corrige 27 redacciones con **tu rúbrica**.
- Redacta correos a 25 familias en 1 minuto.
- Detecta el error grupal del día.
- Pie: "Lo construyes una vez."

**Card derecha — "Después, con tu alumno"** (icon: `ph-graduation-cap`)
- Practica fuera de clase.
- Explica con **tus ejemplos**.
- Corrige como **tú** lo harías.
- Nunca se impacienta. Disponible a las 23:00.
- Pie: "Lo recibe — con tu voz dentro."

Slogan central: **"Construyes una vez. Se usa dos veces."**

### Zona C — comunidad
- Título: "¿Por qué no sacas ese agente que llevas dentro?"
- Cuerpo: "Te ayudamos. Únete a la comunidad ELE. / Sin código — solo tu expertise."
- QR → `https://forms.hablandis.com/hablandis/form/elencuentroeleMiln/formperma/RZKSb0WA04Szly2Z32iJ1i6yml9-5md5qPNbw2hCQ8A`
- Hint: "Escanea para unirte"
- Orb de Eliana 88px en esquina inferior derecha (decorativo, sin pointer events).

### Zona D — ELITE acrónimo
Título: "Qué significa ser **ELITE**"

| Letra | Palabra | Glosa |
|-------|---------|-------|
| E | Empático | escucha al alumno · lee el contexto |
| L | Leal | fiel a tu criterio · a tu rúbrica |
| I | Intuitivo | sabe qué pasa · actúa sin dictado |
| T | Tenaz | no abandona · termina lo empezado |
| E | Elegante | explica con gracia · entrega pulido |

## 5. Interacciones

### Chip rotator (Zona A)
- Intervalo: 2500ms entre cambios.
- Transición: 350ms `is-out` (blur 0→8px, opacity 1→0, translateY 0→-10px) + 450ms `is-in` (simétrico al revés).
- Loop infinito hasta que `hideDiapo5Screen()` o el listener `nav-next` llaman a `stopDiapo5ChipRotator()`.

### Focus cards (Zona B)
- Hover CSS puro: cuando el usuario hace hover sobre `.diapo5-focus-grid`, TODAS las `.diapo5-card` entran en `filter: blur(2px) brightness(0.92); transform: scale(0.98)`. La carta específicamente hovered vuelve a `blur(0) brightness(1); scale(1.02)` con borde mostaza y sombra.
- Sin JS. Accesible con teclado solo vía `:hover` de mouse/trackpad (MVP; no es bloqueante para el objetivo de proyector).

### ELITE reveal (Zona D)
- Al abrir la diapo, los 5 items están `opacity:0; transform: translateX(-14px)`.
- IntersectionObserver con `threshold: 0.25` observa el primer item; al entrar en viewport, aplica `is-revealed` a cada item con stagger 200ms (E→L→I→T→E).
- Fallback: si pasados 1500ms el primer item no ha entrado en viewport, se dispara el reveal de todos modos.

### Highlighters
- `#diapo5-elite-highlight` (la palabra ELITE del hook) se enciende con delay 600ms.
- `#diapo5-slogan-highlight` (el slogan de la Zona B) se enciende con delay 1400ms.
- Ambos usan `scaleX(0 → 1)` desde `transform-origin: left center` con transición de 0.9-1.1s.

## 6. TTS
Al entrar en la diapo (delay 400ms) Eliana pronuncia literalmente:

> Eres un profe ELITE. Tus agentes lo serán también. Lo que harán por ti, para ti, contigo.

Nada más. No hay chat. No hay auto-avance. No hay wake-word. Román continúa en persona.

`hideDiapo5Screen()` y el listener de `diapo5-nav-next` llaman `stopTTS()` + `stopDiapo5ChipRotator()` antes de transicionar.

## 7. Responsive
- Default: grid 2-columnas (1.15fr / 1fr) con hook a ancho completo arriba.
- ≤1280px: padding reducido a 88px top / 28px lados, gap 20px.
- ≤1100px: se colapsa a una sola columna (hook / a / b / c / d stacked).
- ≤820px alto: padding-top 80px, gap 18px, zonas 16×20, ELITE items compactos (padding 6×10, letra 26px).
- ≤720px: padding 84×16, focus cards a una columna, orb de Eliana a 64px, community title sin max-width.

## 8. Navegación
- Botón back → `hideDiapo5Screen()` → vuelve a `showJuegoScreen()` (diapo 4).
- Botón next → fade-out 300ms → `showDiapo6Screen()` (Elige tu agente MIAU).
- En móvil, `showDiapo5Screen()` hace bypass directo a `showDiapo6Screen()` (la diapo es solo de escritorio, pensada para proyector).

## 9. Archivos tocados
- `static/index.html` — bloque `#diapo5-screen` completo.
- `static/style.css` — sección DIAPO 5 (sustituida por completo).
- `static/app.js` — bloque `// DIAPO 5` (sustituido por completo) + limpieza en `updateRecordingUI`, wake-word handler, `processTranscription`, `updateVoiceButtonsUI` y state.
- `static/encuesta.html` — footer version.
- `static/juego3_mobile.html` — footer version.
- `CHANGELOG.md` — entrada v23.16.0.
- Este spec.

## 10. Dependencias externas
- `qrcode-generator@1.4.4` (CDN jsdelivr) — ya cargado en `index.html` para diapo 4, reutilizado aquí.
- `orb.js` → `window.orbCreateInElement` para el orb decorativo de Eliana.
- Phosphor icons (ya cargados).
- No hay LLM. No hay WebSocket. No hay Whisper.

## 11. Test manual (DoD)
1. Entrar en la app, avanzar hasta diapo 5.
2. Verificar hook renderiza y la palabra ELITE se subraya en amarillo tras ~600ms.
3. Eliana dice el hook completo (texto §6) sin contenido extra.
4. Chip rotator: cuenta cada cambio, debe recorrer las 7 palabras sin saltar ninguna y volver al inicio.
5. Hover sobre cualquier focus card → la otra se desenfoca, la hovered se resalta con borde mostaza.
6. Slogan de la Zona B se subraya en lavanda tras ~1400ms.
7. QR aparece renderizado (SVG). Escanear con móvil debe abrir el form de Hablandis.
8. Orb de Eliana visible abajo-derecha de la Zona C, sin interferir con clicks.
9. Los 5 items ELITE aparecen con stagger (200ms entre letras). Verificar que en pantallas pequeñas (<820px alto) también se ven todos sin scroll interno.
10. Navegación back → diapo 4. Navegación next → diapo 6. Chip rotator y TTS se detienen al salir (sin fugas de `setInterval`).
11. Recargar con `?screen=diapo5` (si existe deep link) funciona (no bloqueante).
12. En móvil (ancho < 768), al pulsar el botón que normalmente lleva a diapo 5, saltar directo a diapo 6 (bypass).
