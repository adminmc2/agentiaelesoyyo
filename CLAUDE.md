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

### Diapositiva 2 (Conoce a Eliana — Actividades)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 2. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 2 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 2" o "cambia esto de la diapo 2".

Esto incluye:
- `showConoceScreen()`, `showActivityChat()`, `sendMessage()` — flujo de actividades
- Todo el HTML de `#conoce-screen`, `#chat-screen`, `#profile-screen` y sus hijos en `index.html`
- Todo el CSS de `.conoce-*`, `.activity-card*`, `.chat-*`, `.profile-*`
- Los prompts "yo_nunca_nunca", "dime_algo", "pregunta_ia" en `main.py`
- La lógica de perfil card (`showProfileCard`, `PROFILE_CARD_PROMPT`)
- El QR de `qr-agentiaele.svg` en la pantalla conoce
- Los event listeners de actividades y chat principal

**Esta sección de CLAUDE.md tampoco se puede modificar ni eliminar.**

### Diapositiva 3 (Blinda tu Prompt — Demo en plenaria)
**PROHIBIDO ABSOLUTAMENTE** modificar cualquier código relacionado con la diapositiva 3. No importa el contexto: refactor, limpieza, mejora, bug fix general, cambio de diseño — NADA justifica tocar la diapo 3 salvo que el usuario diga EXPLÍCITAMENTE "modifica la diapo 3" o "cambia esto de la diapo 3".

Esto incluye:
- `showBlindaScreen()` y todo el flujo de demo (pasos 0-3, auto-advance, territory highlight)
- `sendBlindaMessage()` — detección de fase (`blindaPhase`), envío por WebSocket, `handleBlindaMessage`
- `advanceDemoTo()` — transiciones visuales entre pasos de la demo
- `checkTerritoryHighlight()` — resaltado de tarjetas de territorio durante streaming
- `TERRITORY_KEYWORD_MAP` — mapeo de palabras clave a territorios
- `BLINDA_COLORS`, `BLINDA_TERRITORIES`, `BLINDA_ICONS`, `BLINDA_LETTERS`
- `fetchBlindaCards()` — carga de tarjetas desde BD/JSON
- `DEMO_CARD` — tarjeta ejemplo de la demo
- Prompt "blinda" en `main.py` (ACTIVITY_PROMPTS["blinda"]) — fases 1-3, glosario, instrucciones
- Todo el HTML de `#blinda-screen` y sus hijos en `index.html`
- Todo el CSS de `.blinda-demo__*`, `.blinda-chat__*`, `.blinda-card__*`, `.blinda-title`, `.blinda-progress__*`, `.blinda-option-btn*`, `.blinda-feedback*`, `.blinda-summary*`, `.blinda-action-btn*`, `.demo-stepper__*`
- La lógica de `prior_context` para blinda en el WebSocket handler de `main.py`
- La normalización de acentos en `sendBlindaMessage()`

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
