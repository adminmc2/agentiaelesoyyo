# Instrucciones para Claude Code

## Zonas protegidas — NO MODIFICAR bajo ningún concepto

### Diapositiva 1 (Login)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 1. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 1 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 1" o "cambia esto de la diapo 1".

Esto incluye:
- Todo el HTML de `#login-screen` y sus hijos en `index.html`
- Todo el CSS de `.login-*` y `.creatures-*`
- `handleLogin()`, `showLoginScreen()` y toda la lógica de autenticación en `app.js`
- `static/creatures.js` — animaciones GSAP de criaturas en login
- El endpoint `/api/login` en `main.py`

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

### Diapositiva 2 (Aprende qué es un agente de IA — juego-intro)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 2. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 2 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 2" o "cambia esto de la diapo 2".

Esto incluye:
- `showJuegoIntroScreen()`, `hideJuegoIntroScreen()` — mostrar/ocultar la pantalla
- Todo el HTML de `#juego-intro-screen` y sus hijos en `index.html` (QR SVG inline, gato, título, subtítulo, "¿Cómo se juega?", 5 pasos, CTA)
- Todo el CSS de `.jintro-*` (screen, page, body, qr-side, qr-card, qr-svg, qr-label, main, main__head, main__cat, main__head-text, main__title, main__subtitle, main__how, list, list__item, list__num, list__text, cta, responsive breakpoints)
- El QR SVG inline con path completo en `index.html` (no depender del archivo servido)
- La imagen `static/imagenes/explorador.png` (gato narrador)
- Los event listeners de `juego-intro-back`, `juego-intro-next`, `juego-intro-empezar`
- El deep link `?screen=juego-intro`
- Los textos de los 5 pasos ("Aprende qué es un agente de IA", "¿Cómo se juega?", y los 5 items)

El antiguo `#conoce-screen` (Conoce a Eliana) queda como LEGACY oculto y no forma parte del flujo activo. No es necesario mantenerlo protegido.

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

### Diapositiva 3 (Descubre al agente — juego3)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 3. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 3 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 3" o "cambia esto de la diapo 3".

Esto incluye:
- El juego de cartas: `#juego3-screen` (escritorio) y `/juego3` / `static/juego3_mobile.html` (móvil)
- Archivo de datos: `static/juego3_cards.json` (10 cartas con áreas, formatos, opciones, correcta y explicaciones)
- Backend en `main.py`:
  - Estado `_juego3_state`, caché `_juego3_cards_cache`, conexiones `_juego3_mobile_ws` / `_juego3_dashboard_ws`
  - Funciones `_load_juego3_cards`, `_juego3_state_msg`, `_juego3_tally_msg`, `_juego3_broadcast`
  - Endpoints `GET /juego3`, `GET /api/juego3/cards`, `GET /api/juego3/state`, `POST /api/juego3/reset`
  - WebSockets `/ws/juego3` (móvil) y `/ws/juego3-dashboard` (escritorio)
- 4 formatos visuales: `casting`, `misma-orden`, `mientras-no-estabas`, `titular`
- Iconos exclusivamente Phosphor (sin emojis)
- Widget Eliana flotante con orb reutilizado de `static/orb.js` (paleta clara, arrastrable)
- Pantalla final con Eliana comentando resultados (prompt con tono jocoso/jovial)

El antiguo `#blinda-screen` (Blinda tu Prompt, demo en plenaria) queda como LEGACY oculto con `display:none`, `data-legacy="true"`. Su código HTML/CSS/JS sigue en el repositorio pero no forma parte del flujo activo.

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

### Diapositiva 4 (Blinda tu Prompt — Juego en equipos)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 4. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 4 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 4" o "cambia esto de la diapo 4".

Esto incluye:
- `showJuegoScreen()`, `showJuegoCarousel()`, `startJuegoGame()`, `nextJuegoCard()` — flujo del juego
- `openJuegoCard()` — apertura del modal con card-pair (front + back)
- `selectJuegoOption()` — selección de respuesta y feedback en chat
- `sendJuegoHint()` — chat con Eliana para pistas via WebSocket
- `showJuegoSummary()` — tarjeta de resultados con learnings y discusión
- `isOnJuegoModal()` — detección de modal activo para STT
- Todo el HTML de `#juego-screen`, `#juego-card-modal` y sus hijos en `index.html`
- Todo el CSS de `.juego-*` (carrusel, modal, tarjetas, opciones, summary, responsive)
- Las tarjetas en `cards_categorized.json` y el endpoint `/api/prompt-cards`
- El endpoint `/api/prompt-cards/sync` en `main.py`
- Los event listeners de `juego-mic-btn`, `juego-voice-btn`, `juego-chat-send`

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

### Diapositiva 5 (El Agente según los Grandes Maestros — Metáfora del Chef)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 5. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 5 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 5" o "cambia esto de la diapo 5".

Esto incluye:
- `showDiapo5Screen()`, `hideDiapo5Screen()` — mostrar/ocultar pantalla
- `sendDiapo5Message()` — envío por WebSocket con `activity_mode: 'agentes'`
- `addDiapo5ChatBubble()` — burbujas de chat
- `checkDiapo5Advance()` — auto-avance por keywords de Eliana
- `advanceDiapo5To()` — transiciones visuales entre pasos (0-9)
- `DIAPO5_KEYWORD_MAP` — mapeo de palabras clave a pasos
- `DIAPO5_CLOUD_WORDS` — palabras de la nube (step 1)
- `DIAPO5_CAPABILITIES` — las 5 capacidades del agente
- `renderDiapo5WordCloud()`, `renderDiapo5Intro()`, `renderDiapo5Capability()`, `renderDiapo5Closing()`, `renderDiapo5Song()` — renderizado de cada paso
- Prompt "agentes" en `main.py` (ACTIVITY_PROMPTS["agentes"]) — fases 0-7, metáfora del chef
- Todo el HTML de `#diapo5-screen` y sus hijos en `index.html`
- Todo el CSS de `.diapo5-*` (layout, word cloud, capacidades, canción, stepper)
- La lógica de `prior_context` para agentes en el WebSocket handler de `main.py`
- El archivo `static/cancion-agente.mp3`

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

### Diapositiva 6 (Agentes MIAU — Elige tu agente)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 6. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 6 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 6" o "cambia esto de la diapo 6".

Esto incluye:
- `showDiapo6Screen()`, `hideDiapo6Screen()`, `initDiapo6()` — mostrar/ocultar/inicializar pantalla
- `sendDiapo6Message()` — envío por WebSocket con `activity_mode: 'miau'`
- `addDiapo6ChatBubble()` — burbujas de chat
- `updateDiapo6Step()`, `advanceDiapo6()` — transiciones visuales entre pasos (0-4)
- `DIAPO6_KEYWORD_MAP` — mapeo de palabras clave a pasos
- `DIAPO6_AGENTS` — definición de los 8 agentes (act1 y act2) con nombres, imágenes y descripciones
- `DIAPO6_TOTAL_STEPS`, `DIAPO6_OPINION_LABELS` — constantes
- `renderDiapo6CatsGrid()` — grid de 8 gatos mini
- `renderDiapo6AgentCards()` — cards con select dropdown para adivinar nombres
- `checkDiapo6AgentAnswer()` — verificación de respuesta (verde/rojo)
- `renderDiapo6Bars()` — barras de votación (agentes + opiniones)
- `connectDiapo6Dashboard()`, `updateDiapo6Dashboard()` — WebSocket del dashboard en tiempo real
- Prompt "miau" en `main.py` (ACTIVITY_PROMPTS["miau"]) — momentos 1-6, agentes MIAU
- WebSocket `/ws/encuesta` y `/ws/encuesta-dashboard` en `main.py` — votación en tiempo real
- Ruta `/encuesta` y `static/encuesta.html` — página móvil de votación + preguntas de conversación
- `_encuesta_votes`, `_encuesta_dashboard_ws`, `_build_vote_summary()` en `main.py`
- Todo el HTML de `#diapo6-screen` y sus hijos en `index.html`
- Todo el CSS de `.diapo6-*` (layout, agent cards, cats grid, dashboard, barras, try, responsive)
- Los QR: `qr-materiaele.svg`, `qr-encuesta.svg` en `static/imagenes/`
- Los event listeners de `diapo6-chat-send`, `diapo6-mic-btn`, `diapo6-voice-btn`, `diapo6-nav-next`, `diapo6-nav-back`

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

---

## Sistema de diseño v23 — Paleta pastel (Combo 3)

### Paleta oficial
| Rol | Color | Hex | Uso |
|-----|-------|-----|-----|
| Primary | Lavanda | `#D0AAD1` | Botones principales (texto oscuro #2c2c2c) |
| Accent amarillo | Mostaza oscuro | `#C9A632` | Header sólido de todas las diapositivas |
| Título marca | Mostaza profundo | `#8A6A1C` | Solo para "Eliana" en la portada |
| Surface | Crema | `#FFE7C1` + fondo `#E8F2F3` (menta suave) | Background |
| Accent | Menta | `#D0E8E9` | Chips, estados tranquilos |
| Success | Verde menta | `#8CBEB2` | Estados correctos |

**Nota (v23.3.5):** sistema simplificado a UN SOLO amarillo sólido `#C9A632` (mostaza oscuro) — se eliminó el mostaza claro `#E8CB4E` por falta de contraste. El melocotón `#F4C09D` y el rosa `#F2AAAE` ya habían sido eliminados en v23.3.3.

### Header estándar de diapositivas
- Clase: `.slide-header` (position: fixed, top)
- Fondo: **color sólido** `#C9A632` (sin gradiente)
- Texto: blanco TODO en **negrita 900** (Dosis 900 título 24px, Source Sans 900 pill, 900 subtítulo)
- Contiene: número de diapo (pill frosted), título, subtítulo
- Navegación: `.slide-nav-btn` redondos Lavanda con iconos oscuros (hover: púrpura + blanco)

### Formato
- **Escritorio primero**: todos los layouts optimizados para proyector / pantalla grande
- **Responsive**: solo ajustes menores para móvil
- **Fondo menta**: `body`/`html` tienen `#E8F2F3` como base; las pantallas usan `background: transparent`

### Versionado
- Tras CUALQUIER cambio en HTML/CSS/JS: bump `?v=` en `index.html` Y `encuesta.html`
- Prefijo `v23.x.y` desde el cambio de paleta (abril 2026)

### Gatos reales (static/imagenes/)
- `aprobador.png`, `enfocado.png`, `expansor.png`, `explorador.png`, `improvisador.png`, `masticador.png`, `miron.png`, `suerte.png`, `traduccion.png`
- Usar estos cuando se necesiten los personajes gato de la presentación, no los creatures abstractos.
