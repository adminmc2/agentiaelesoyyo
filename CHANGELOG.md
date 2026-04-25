# Changelog — AgentiaELE

## v23.22.3 — 2026-04-25 — Chat móvil LucAPI · OCR · opciones tappables (fases 1-6 + escaneo)
Primera versión funcional del chat de LucAPI accesible vía `/lucapi`. Es la experiencia que verán los alumnos al escanear el QR de la diapo 7 desde su móvil. Funciona también en desktop.

**Funcionalidades**:
1. **Chat conversacional** con LLM real (streaming, mismo `/ws/chat` con `activity_mode: "lucapi"`).
2. **Avatar "LC"** en círculo mostaza para LucAPI; burbujas alternadas con paleta v23.
3. **Flujo de 6 fases**:
   - F1: saludo (español).
   - F2: pregunta de lengua (sugerencias para Viena: Deutsch, Polski, Čeština, Magyar… acepta cualquier lengua del mundo).
   - F3: confirmación en la lengua elegida + petición de escaneo.
   - F4: tras escaneo, frase de enganche con la temática detectada (sin citar título).
   - F5: predicción personal adaptada al texto (familia pequeña/grande o día ocupado/tranquilo).
   - F6: reacción cálida a la predicción.
4. **OCR real con Tesseract.js** (CDN). Identifica el texto contando palabras distintivas — funciona aunque solo se escanee un fragmento del cuerpo.
5. **Modal de cámara full-screen** con guías mostaza, scan-line animada, capture + preview con "repetir/usar esta".
6. **Opciones tappables**: convención `OPCIONES: A / B / C` en respuestas del LLM → cliente las parsea y renderiza como pildoritas (lavanda) bajo la burbuja. Tocar una envía como respuesta.

**Cambios técnicos**:
- `main.py`: nuevo `ACTIVITY_PROMPTS["lucapi"]` con las 6 fases detalladas + convención OPCIONES. Nueva ruta `GET /lucapi`.
- `static/lucapi_mobile.html` (NUEVO): app móvil — header mostaza, chat streaming, modal cámara, OCR Tesseract, parser de opciones, botones tappables.
- `docs/`: 3 MDs nuevos (diapo-ia-para-estudiantes, diapo-ia-para-profes, diapo-pildoras-formativas) — contenido editorial de las diapos hermanas.

**Pendiente**: fases 16.2 paso 2-4, 16.3 vocab, 16.4 lectura global, 16.5 fichas, 16.6 chat inferencia, 16.7 opinión, 16.8 cierre. Conectar QR diapo 7 → URL móvil. Probar móvil real vía ngrok (cámara requiere HTTPS).

Versionado sync → v23.22.3 (`index.html`, `juego3_mobile.html`, `lucapi_mobile.html`).

## v23.22.2 — 2026-04-25 — Diapo 7: textos reales A y B del usuario
Sustitución de los placeholders inventados por los textos reales proporcionados por el usuario.

**Texto A — "Familia pequeña"** (A1, ~150 palabras)
- Extiende el spec original añadiendo descripciones físicas y nombres explícitos (Javier, María, Sara, Luis).
- Incluye: familia de 4 + perro, descripción física (padre alto y rubio, madre morena y delgada, hermana más alta y mayor que ella), rutina (desayuno juntos, deberes, compras los viernes).
- Encaja con el stat "Familia + descripción física".

**Texto B — "Mi día" (María)** (A1, ~120 palabras)
- María Pérez, 19 años, nacida en Málaga, vive en Granada, estudiante de Periodismo.
- Cubre rutina semanal completa: lunes-viernes (universidad), fines de semana (Málaga familia, perro, paseos, ocio).
- Nuevo stat "Rutina semanal" (antes "rutina diaria" no reflejaba la estructura del texto).

**Cambios**:
- `static/app.js`: `DIAPO7_TEXTS.a.body` y `.b.body` actualizados con los textos íntegros. Stats actualizados (palabras 80→150 para A, 75→120 para B, "rutina diaria"→"Rutina semanal" para B).
- `static/index.html`: previews (`diapo7-card__excerpt`) reemplazados por las primeras frases reales de cada texto. Pills de stats sincronizadas con los nuevos valores.

Versionado sync → v23.22.2.

## v23.22.1 — 2026-04-25 — Diapo 7: título "Agentes con estrategia" + modal textos + cards grandes
Ajustes pedidos por el usuario tras v23.20.1:

1. **Título del header** cambia de "LucAPI · Comprensión lectora" → **"Agentes con estrategia"**.
2. **Cards más grandes** (más protagonismo visual): padding 28/26 (antes 20/20), min-height 360-520 (antes 280-380), icon 80-120 (antes 60-80), título 28-44 (antes 22-34), stats 15-19 (antes 13-16), excerpt 18-24 (antes 15-20), borde-radius 26 (antes 24).
3. **Click en card → modal con texto completo**. Nueva estructura `.diapo7-modal` con backdrop blur + panel neobrutalism (borde 6px + shadow 16×16). Muestra: pill TEXTO A/B, título grande, stats pills, texto completo con fondo temático (crema-mostaza para A, lavanda para B). Cierre con X, backdrop o tecla Escape. Animación scale(0.96→1) al abrir.
4. **Stat de Familia pequeña** cambia de "4 personajes" → **"Familia + descripción física"**.

**Textos placeholder** incluidos en `DIAPO7_TEXTS` (constante JS):
- Texto A "Familia pequeña" (~80 palabras, familia de 4 con descripción física de cada miembro).
- Texto B "Mi día" (~75 palabras, rutina diaria).
Estos textos pueden ajustarse cambiando solo la constante.

**Cambios técnicos**:
- `static/index.html`: título + stat actualizados. Nuevo bloque `#diapo7-modal` con backdrop, panel, close-btn, pill, title, stats-container, text-container dentro de `#diapo7-screen`.
- `static/style.css`: cards más grandes. Nueva sección modal (`.diapo7-modal*`) con z-index 10000, transiciones opacity + scale, variantes `--a`/`--b` por color. `.diapo7-card::after` añade hint "Ver texto completo →" en esquina inferior derecha que se opaca en hover.
- `static/app.js`: nueva constante `DIAPO7_TEXTS` con datos estructurados. `initDiapo7Tilt` amplía: añade listener click en cada card que llama `openDiapo7Modal(key)`. Nuevos `openDiapo7Modal(key)` (inyecta contenido + quita `hidden`) y `closeDiapo7Modal()`. Listeners idempotentes para backdrop, close-btn y tecla Escape.

Versionado sync → v23.22.1.

## v23.20.1 — 2026-04-25 — Diapo 7 LucAPI · proyector estático (QR + 2 cards tilt 3D)
Se sustituye el esqueleto de 8 pasos placeholder por la versión definitiva: **pantalla estática, una única visualización, sin pasos, sin modal, sin chat**. La experiencia interactiva vive en `/lucapi` (otro scope, mobile chat del otro agente).

**Layout**: header mostaza "07 · LucAPI · Comprensión lectora" + 2 columnas. Izquierda QR grande (280-400px responsive) con QR dinámico via `window.qrcode` apuntando a `${location.origin}/lucapi`. Derecha 2 cards tilt 3D (Familia pequeña mostaza + Mi día lavanda) con stats y fragmento citado.

**Cambios**:
- `static/index.html`: `#diapo7-screen` reescrito con `.diapo7-layout` 2 cols, `.diapo7-qr-card` y 2 `.diapo7-card[data-tilt]`. Sin pasos, sin flechas laterales.
- `static/style.css`: sección DIAPO 7 reescrita desde cero (neobrutalism 5px + shadow 10×10, perspective 1400px, preserve-3d, responsive 1100/720).
- `static/app.js`: eliminado todo el esqueleto (constantes DIAPO7_INGREDIENTS/ACTIVITY_TYPES/STRUCTURES, funciones _diapo7GoToStep/PrevStep/NextStep/updateStep/renderIngredients/etc, state _diapo7Ws/_diapo7ContextSent, diapo7MicBtn de updateRecordingUI, diapo7-voice-btn, rama wake-word). Sustituido por: `showDiapo7Screen` (bypass móvil + QR + tilt), `hideDiapo7Screen`, `isOnDiapo7Screen`, `initDiapo7QR` (idempotente), `initDiapo7Tilt` (rotateY/X idempotente).
- Listeners: `diapo7-nav-back` → `showDiapo6Screen`, `diapo7-nav-next` → `showFinalScreen`. Eliminados chat/mic/voice/laterales.
- `CLAUDE.md`: nueva sección protegida "Diapositiva 7 (LucAPI · Comprensión lectora — v23.20.0 · proyector estático)".

Fuera de scope: `static/lucapi_mobile.html` y ruta `/lucapi` las crea el otro agente (ver v23.20.0 del chat móvil).

Versionado sync → v23.20.1.

## v23.20.0 — 2026-04-25 — Chat móvil LucAPI (fase 16.1 — saludo)
Se añade el chat móvil de LucAPI (agente de comprensión lectora A1) como ruta `/lucapi` servida por FastAPI. Es la experiencia que verán los alumnos al escanear el QR de la diapo 7 en su móvil. Desde el ordenador, se puede abrir directamente en `http://localhost:9000/lucapi` para testear.

**Alcance**: solo la **fase 16.1 (Saludo)** del spec. LucAPI saluda al abrir el chat, responde al estudiante y lo prepara para el siguiente paso. Fases 16.2–16.8 se apilan en iteraciones siguientes.

**Cambios**:
- `main.py`: nueva ruta `GET /lucapi` → sirve `static/lucapi_mobile.html`. Nuevo prompt `ACTIVITY_PROMPTS["lucapi"]` con reglas de estilo A1 y la fase de saludo.
- `static/lucapi_mobile.html`: nuevo archivo. Chat móvil full-screen con paleta v23 (header mostaza, bubbles, avatar "LC" mostaza en las intervenciones de LucAPI). Conectado al WebSocket `/ws/chat` con streaming real. Disparo automático del saludo al conectar.
- Sin OCR · sin selector de texto A/B · sin mic/STT · sin TTS.

Versionado sync → v23.20.0 (`index.html`, `juego3_mobile.html`, `lucapi_mobile.html`).

## v23.19.6 — 2026-04-25 — Diapo 6: Eliana habla de Strategos (prompt + chat contextual)
Fase 6/6 — la diapo 6 "IA para estudiantes" (Strategos) cierra con Eliana contextualizada para que hable solo del contenido de esta diapo cuando el usuario abra el widget flotante.

**Backend — `main.py`**:
- Nuevo prompt `"strategos"` en `_DEFAULT_PROMPTS`. Describe: qué es Strategos (tarjetas pedagógicas con agentes), las 3 ideas de cómo funciona en clase (atención diferenciada, del papel a la pantalla, agente opcional), LucAPI y sus 4 pasos (Prepárate, Lee con una misión, Busca las pruebas, Conecta), la frase identitaria ("LucAPI nunca da la respuesta. Te ayuda a descubrirla."), la filosofía (estrategia no ejercicio · preguntas no respuestas · analógico+digital · "el profe se multiplica"), los otros usos, y la URL https://strategos.up.railway.app/. Bloque "DE QUÉ NO HABLAR" prohíbe mencionar juego, chef, MIAU, Hablandis, o inventar otros agentes estrella.
- Añadido `"strategos"` al filtro `ACTIVITY_PROMPTS`.

**Frontend — `app.js`**:
- `sendBlindaMessage` (función del widget): `activity_mode` dinámico por cascada — `isOnDiapo6Screen() → 'strategos'`, `isOnDiapo5Screen() → 'diapo5'`, fallback `'juego3_chat'`.
- `showDiapo6Screen`: reset del chat del widget con mensaje inicial específico: "Hola, soy Eliana. Esta diapo es sobre Strategos: tarjetas pedagógicas con agentes de IA dentro, para tus estudiantes. Pregúntame por LucAPI, por cómo se reparten las tarjetas en clase, o por la filosofía 'preguntas, no respuestas'."

**Resultado**: al abrir la diapo 6 y clicar el widget flotante, Eliana saluda contextualizada y sus respuestas usan el prompt `strategos` (no el de `juego3_chat` ni el de `diapo5`).

Versionado sync → v23.19.6. Requiere reinicio del servidor FastAPI para que recoja el nuevo prompt.

## v23.19.5 — 2026-04-25 — Diapo 6: CTA Strategos en paso 2 + reducción a 3 pasos (paso 4 cancelado)
El usuario decide que la fase 5 (paso 4 con comic-text + AnimatedButton + QR + filosofía) NO se implementa. En su lugar, añade un **CTA directo a Strategos** al final del paso 2 (focus-cards) para que al hacer click lleve a la comunidad fuera de la presentación.

**Cambios**:
- `static/index.html`: eliminado el `<section data-step="4">` por completo (era solo placeholder). Añadido al final del paso 2, debajo del `.diapo6-focus-grid`, un `<a class="diapo6-cta-btn" href="https://strategos.up.railway.app/" target="_blank" rel="noopener">` con texto "Entra en Strategos" + icono arrow-right.
- `static/style.css`: nueva clase `.diapo6-cta-btn` — estilo AnimatedButton neobrutalism adaptado de sgel: fondo mostaza, borde negro 5px, shadow duro `8×8`, rotación inicial `-2deg`, hover `bg crema + rotate(1deg) + scale(1.05) + shadow 12×12`, active `scale(0.97) + shadow 4×4`. Tamaños grandes (font 22-34, padding 18/36).
- `static/app.js`:
  - `DIAPO6_TOTAL_STEPS = 3` (antes 4). `diapo6NextStep` en el paso 3 ya va a pantalla final automáticamente por la comprobación `_diapo6Step >= DIAPO6_TOTAL_STEPS`.
  - Deep-link `?screen=strategos&step=N` ahora acepta rango 2-3 (antes 2-4).

**Resultado**:
- Diapo 6 tiene 3 pasos: (1) layout-text-flip "Strategos es…" + descripción; (2) focus-cards con 3 cards + **CTA a Strategos**; (3) 3D card volteable + LucAPI circular progress + cita.
- La flecha lateral → desde el paso 3 termina la diapo 6 (va a pantalla final).
- La flecha superior-derecha del header también termina la diapo (sin importar el paso).

Versionado sync → v23.19.5.

## v23.19.4 — 2026-04-25 — Diapo 6 paso 3 (3d-card volteable + LucAPI circular progress)
Fase 4/6 de la diapo 6 "IA para estudiantes". Paso 3 con dos UIs en paralelo adaptados de sgel:

**Izquierda — Tarjeta pedagógica volteable en 3D** (adaptado de `3d-card.tsx`):
- Contenedor con `perspective: 1400px` + card con `transform-style: preserve-3d`.
- Hover → `transform: rotateY(180deg)` en 800ms cubic-bezier.
- Dos caras con `backface-visibility: hidden`:
  - **Cara A** ("Lee en Cuatro Pasos"): ol numerada con 4 pasos (Prepárate / Lee con una misión / Busca las pruebas / Conecta) con números circulares mostaza estilo neobrutalism.
  - **Cara B** ("Los trucos del experto"): ul con iconos Phosphor (lightbulb, target, magnifying-glass, link) y los cuatro trucos del spec.
- Pill "CARA A" / "CARA B" mostaza arriba-izquierda como marcador de lado.

**Derecha — LucAPI circular progress**:
- Header con avatar circular mostaza (icono `ph-book-open-text`) + "LucAPI · el agente estrella · Comprensión Lectora".
- Ring SVG con 2 círculos (track gris mostaza + fill sólido mostaza) de r=42. stroke-dasharray animado via CSS variable `--progress` (0-1).
- Centro del ring: "X / 4" (mostaza chico) + label del paso actual (Dosis 900 grande).
- Descripción bajo el ring.
- Cada 2.8s avanza al siguiente paso: actualiza `--progress` (animación CSS 700ms del stroke-dashoffset), label y desc con transición "is-swapping" (opacity + translateY). Loop al llegar al 4.

**Cita inferior**: pill violeta con borde y shadow duro: "LucAPI **nunca da la respuesta**. Te ayuda a descubrirla."

**Cambios**:
- `static/index.html`: paso 3 con `.diapo6-duo-layout` (grid 2 columnas) + 3D-container + LucAPI ring + quote.
- `static/style.css`: sección `/* PASO 3 — 3D card + LucAPI */` con `.diapo6-3d-container`, `.diapo6-3d-card*`, `.diapo6-lucapi*`, `.diapo6-step3-quote`. Tamaños grandes (title 22-34, icon wrap 60-88, ring 220-320, quote 20-30).
- `static/app.js`: nuevas constantes `DIAPO6_LUCAPI_STEPS` (4 pasos) y `DIAPO6_LUCAPI_INTERVAL_MS = 2800`. State `_diapo6LucapiTimer`, `_diapo6LucapiIndex`. Funciones `_diapo6StartLucapi`, `_diapo6ApplyLucapiStep`, `_diapo6StopLucapi`. Cableado en `_diapo6RunStep(3)` / `_diapo6StopStep(3)` / `_diapo6StopAll`.

Versionado sync → v23.19.4.

## v23.19.3 — 2026-04-25 — Diapo 6 paso 2 (focus-cards)
Fase 3/6 de la diapo 6 "IA para estudiantes". Se implementa el **paso 2** con el UI `focus-cards` (adaptado de sgel a vanilla JS, efecto CSS puro sin React).

**Paso 2 — Cómo funciona en clase**:
- Hook actualizado: "Cómo funciona **en clase**." (highlighter mostaza sobre "en clase").
- Grid de 3 cards estilo neobrutalism (border negro 5px + shadow duro `10px 10px 0`) con los 3 bloques del spec:
  1. **Atención diferenciada** (icon `ph-users-three`, fondo mostaza) — reparto del profe + rincón de tarjetas.
  2. **Del papel a la pantalla** (icon `ph-qr-code`, fondo lavanda) — enlace al agente de IA.
  3. **El agente es opcional** (icon `ph-sparkle`, fondo verde menta) — la tarjeta funciona sola.
- Icon wraps con cuadro de color + borde negro + shadow duro.
- **Efecto focus-cards**: `.diapo6-focus-grid:hover .diapo6-focus-card` aplica `blur(4px) + scale(0.98) + opacity 0.72` a todas; la card que el ratón sobrevuela (`:hover :hover`) revierte a `blur(0) + scale(1.03) + shadow aumentada`. Hover desenfoca siblings — el foco guía al lector card por card.

**Cambios**:
- `static/index.html`: paso 2 con `.diapo6-focus-grid` + 3 `<article class="diapo6-focus-card">`.
- `static/style.css`: nueva sección `/* PASO 2 — Focus cards */` con `.diapo6-focus-grid`, `.diapo6-focus-card*`, regla hover siblings-blur. Tamaños grandes (title clamp 24-36, desc 17-24, icon wrap 72-108, shadow 10×10→14×14 en hover). Responsive a 1 columna bajo 1000px.
- `app.js`: sin cambios — paso 2 es estático (solo CSS hover), el `_diapo6RunStep(2)` y `_diapo6StopStep(2)` ya son no-op.

Versionado sync → v23.19.3.

## v23.19.2 — 2026-04-25 — Diapo 6: agrandar componentes al nivel de diapo 5
El usuario reporta que los componentes de la diapo 6 se ven pequeños comparados con la diapo 5. Se aplica la misma escala tipográfica aprobada para diapo 5 (y que se mantendrá en los próximos pasos 2, 3, 4 pendientes).

**Cambios** en `static/style.css` sección diapo 6:
- `.diapo6-hook`: clamp(28, 3.2vw, 48px) → **clamp(32, 3.6vw, 56px)** (igual que diapo 5). letter-spacing -0.4 → -0.6. line-height 1.15 → 1.12.
- `.diapo6-flip-layout__pre`: clamp(30, 3.4vw, 52px) → **clamp(40, 4.5vw, 72px)**.
- `.diapo6-flip-layout__pill`: font clamp(30, 3.4vw, 52px) → **clamp(40, 4.5vw, 72px)**. Border 4px → 5px. Border-radius 22 → 26. Padding 10/28 → 14/36. Shadow 8/8/0 → 10/10/0. min-width 260-440 → **340-600**. min-height 58-84 → **74-116**.
- `.diapo6-step1-desc__main`: clamp(18, 1.55vw, 26px) → **clamp(22, 2vw, 34px)**.
- `.diapo6-step1-desc__duo`: clamp(16, 1.35vw, 22px) font-weight 500 → **clamp(20, 1.7vw, 28px) font-weight 600**.

**Criterio aplicable a las fases 3-5** (cuando se implementen paso 2 focus-cards, paso 3 3d-card + progress-bar y paso 4 comic-text + button + QR): mantener la misma escala grande que diapo 5, no repetir el error de quedarse corto.

Versionado sync → v23.19.2.

## v23.19.1 — 2026-04-25 — Separación semántica de flechas (header vs laterales) en diapo 5 y 6
Bug de UX reportado por el usuario: al pulsar la flecha del header (superior-derecha) en la diapo 5 se avanzaba paso a paso en vez de saltar a la diapo 6. Las flechas del header y las laterales hacían exactamente lo mismo. Ahora se separan semánticamente:

- **Flechas del header (slide-header)**: saltan **diapositiva entera**.
  - Diapo 5 ← → vuelve a diapo 3.
  - Diapo 5 → → diapo 6 directo (sin importar el paso actual).
  - Diapo 6 ← → diapo 5.
  - Diapo 6 → → pantalla final.
- **Flechas laterales overlay (caret)**: navegan **pasos internos** (1 → 2 → 3 → 4 o al revés).

Cambios en `static/app.js`: listeners de `diapo5-nav-back/next` y `diapo6-nav-back/next` reescritos como callbacks que hacen fade-out + navegación a la diapo contigua. Los `diapo5-side-prev/next` y `diapo6-side-prev/next` mantienen `diapoXPrevStep/NextStep`.

Versionado sync → v23.19.1.

## v23.19.0 — 2026-04-25 — Esqueleto diapo 7 (LucAPI · Comprensión lectora)
Se añade el cascarón visual de la nueva diapo 7 clonando la estructura v23 (header mostaza sagrado, botones back/next, transición fade 300ms, paleta lavanda/crema/menta). La diapo 7 es accesible desde la flecha `→` del último paso de la diapo 6. Back vuelve a la diapo 6 (listener existente). Only fase A: esqueleto sin lógica — las 8 fases del spec (`docs/diapo7-lucapi-comprension-spec.md`) se integran en sesiones siguientes.

**Cambios**:
- `index.html`: nuevo `<main id="diapo7-screen">` con header v23 y placeholder "En construcción".
- `style.css`: bloque `.diapo7-*` nuevo al final del archivo, override del CSS legacy (que era de una diapo 7 anterior eliminada en v23.17.2).
- `app.js`: `showDiapo7Screen()` reescrita para mostrar realmente la pantalla (antes redirigía a final). `diapo6NextStep()` en el último paso llama a `showDiapo7Screen()` en lugar de `showFinalScreen()`.
- Los listeners de `diapo7-nav-back` y `diapo7-nav-next` ya existían (back → diapo 6, next → final) — no se tocan.

**Modificación autorizada explícita** de `diapo6NextStep` (diapo 6 protegida en CLAUDE.md): solo cambia el destino del último paso, nada más.

Versionado sync → v23.19.0 (`index.html`, `juego3_mobile.html`).

## v23.18.2 — 2026-04-25 — Fix navegación diapo 5 → diapo 6
Bug: en v23.17.2 la diapo 7 se eliminó y al mismo tiempo la diapo 6 todavía no existía (solo había un stub), por lo que `diapo5NextStep` en el último paso se cableó directamente a `showFinalScreen()`. Ahora que la nueva diapo 6 "IA para estudiantes" (Strategos) ya está implementada desde v23.18.0, la flecha superior derecha de la diapo 5 debe avanzar a la diapo 6, no saltar a la pantalla final.

**Fix**: `diapo5NextStep()` en el paso 4 llama a `showDiapo6Screen()` si existe; fallback a `showFinalScreen()` para defensa.

Versionado sync → v23.18.2.

## v23.18.1 — 2026-04-25 — Diapo 6 paso 1 (layout-text-flip)
Fase 2/6 de la diapo 6 "IA para estudiantes". Se implementa el **paso 1** con el UI `layout-text-flip` (adaptado a vanilla JS desde `/proyecto_sgel/src/components/ui/layout-text-flip.tsx`).

**Estructura del paso 1**:
- Hook permanente arriba (ya existía desde v23.18.0): "Una tarjeta · Un agente · Una **estrategia**."
- Layout flip central:
  - Texto fijo a la izquierda: "Strategos es".
  - Pill blanco con borde negro grueso (4px) + shadow duro (`8px 8px 0 rgba(44,44,44,0.9)`) estilo `layout-text-flip`. Dentro: palabra que cambia cada 3s alternando **una TARJETA**, **un AGENTE**, **una ESTRATEGIA**.
  - Transición: saliente `translateY(0→50px) + blur(0→10px) + opacity 1→0` en 500ms; entrante simétrico desde `translateY(-40px)`.
- Descripción debajo:
  - Frase principal: "Una colección de **tarjetas pedagógicas** con **agentes de IA** dentro." (con bold violeta).
  - Par "la tarjeta enseña / el agente practica" en mostaza bold.

**Cambios**:
- `static/index.html`: paso 1 con `.diapo6-flip-layout` + `.diapo6-step1-desc` (reemplaza el placeholder).
- `static/style.css`: nueva sección `/* PASO 1 — Layout text flip */` con `.diapo6-flip-layout*`, keyframes `diapo6FlipWordIn`/`Out`, `.diapo6-step1-desc*`.
- `static/app.js`: constantes `DIAPO6_FLIP_WORDS` y `DIAPO6_FLIP_INTERVAL_MS`. Funciones `_diapo6StartFlipLayout`, `_diapo6StopFlipLayout`. Cableadas a `_diapo6RunStep(1)` / `_diapo6StopStep(1)` / `_diapo6StopAll`. Guarda `isOnDiapo6Screen && _diapo6Step===1` dentro del timer para evitar fugas si el usuario navega.

Versionado sync → v23.18.1.

## v23.18.0 — 2026-04-25 — Nueva diapo 6 "IA para estudiantes" (Strategos) — arquitectura vacía
Se crea desde cero la nueva diapo 6 **"IA para estudiantes"** (producto Strategos) sustituyendo a la MIAU eliminada en v23.17.2. Esta versión entrega solo el **scaffolding** (arquitectura vacía) clonando el patrón de la diapo 5. El contenido de los 4 pasos se implementará en próximas iteraciones.

**HTML**: nuevo `<main id="diapo6-screen">` con header 06 "IA para estudiantes", `.diapo6-stage`, `.diapo6-rays`, flechas laterales overlay y 4 `.diapo6-step` que solo contienen el hook permanente ("Una tarjeta · Un agente · Una **estrategia**.") + un placeholder provisional.

**CSS**: sección `.diapo6-*` clonada de `.diapo5-*` (screen, stage, rays con drift 18s, side-arrow caret, step con transición slide horizontal 700ms, hook con highlighter mostaza sobre "estrategia", placeholder dashed, `--no-transition` para snap del deep-link, responsive 1100/720/760h). Regla defensiva `#diapo6-screen > .slide-header` con `!important + z-index: 9999` (misma lección de diapo 5).

**JS**: sustituido el stub de v23.17.2 por funciones reales — `showDiapo6Screen`, `hideDiapo6Screen`, `isOnDiapo6Screen`, `diapo6NextStep`, `diapo6PrevStep`, `_diapo6GoToStep`, `_diapo6SyncStep`, `_diapo6RunStep` (no-op), `_diapo6StopStep` (no-op), `_diapo6StopAll` (no-op). Constante `DIAPO6_TOTAL_STEPS = 4`. State module-level `_diapo6Step`, `_diapo6ElianaInit`. Bypass móvil con `isMobile()`. Widget Eliana global activado al entrar con patrón juego3. Restaurado `elements.diapo6Screen`. Listeners `diapo6-nav-back/next` y `diapo6-side-prev/next` → `diapo6PrevStep/NextStep`. Deep-link `?screen=strategos` con sub-param `&step=N` (snap directo sin transición).

**CLAUDE.md**: sección diapo 6 reescrita como "EN CONSTRUCCIÓN" con descripción del estado actual y próximos pasos (UIs de sgel por paso + prompt `"strategos"` + chat contextual).

**Pendiente próximas iteraciones**:
- Paso 1 — `layout-text-flip` (TARJETA ↔ AGENTE ↔ ESTRATEGIA).
- Paso 2 — `focus-cards` (3 cards: atención diferenciada / del papel a la pantalla / agente opcional).
- Paso 3 — `3d-card` (tarjeta Cara A/B) + `animated-circular-progress-bar` (LucAPI 4 pasos).
- Paso 4 — `comic-text` ("El profesor no desaparece. Se multiplica.") + `AnimatedButton` + QR a `https://strategos.up.railway.app/`.
- Backend: prompt `"strategos"` en `main.py` + `activity_mode` dinámico en `sendBlindaMessage` + mensaje inicial del chat.

Versionado sync → v23.18.0 (index.html CSS+JS, juego3_mobile.html).

## v23.17.2 — 2026-04-25 — Eliminación de la diapo 7
Se elimina la diapositiva 7 del proyecto y se simplifica el flujo para evitar ejecución innecesaria.

**Cambios**:
- `static/index.html`:
  - eliminado el bloque completo `#diapo7-screen`.
  - bump de `app.js` a `v23.17.2`.
- `static/app.js`:
  - `showDiapo7Screen()` queda como redirección segura a `showFinalScreen()`.
  - `showDiapo5Screen()` en móvil salta a pantalla final.
  - `diapo5NextStep()` en el último paso salta a pantalla final.


## v23.17.1 — 2026-04-25 — Limpieza final diapo6 legacy (MIAU) y eliminación de encuesta móvil
Revisión de cierre del desmontaje de la diapo 6 antigua para reducir ruido y evitar ejecución residual. Se elimina también la función muerta `showMobileEncuesta` y toda la lógica de encuesta móvil.

**Verificado**:
- `static/encuesta.html` eliminado.
- `static/imagenes/qr-encuesta.svg` no existe.
- `static/imagenes/qr-miau.svg` no existe.
- Bloque `#diapo6-screen` eliminado de `static/index.html` (queda solo comentario de retirada).
- Función `showMobileEncuesta` eliminada de `static/app.js`.

**Ajustes finales**:
- `static/app.js`:
  - eliminadas referencias residuales a `elements.diapo6Screen` en navegación.
  - eliminada función `showMobileEncuesta` y toda referencia a encuesta móvil.
  - `showDiapo6Screen()` queda como stub totalmente inofensivo (no-op).
  - `hideDiapo6Screen()` e `isOnDiapo6Screen()` se mantienen como compatibilidad mínima.
- `static/index.html`:
  - cache-busting de `app.js` actualizado a `v23.17.1`.

## v23.16.11 — 2026-04-25 — Endurecimiento responsive diapo5 para TV/proyector y portátiles Windows
Refuerzo CSS en diapo 5 para priorizar visualización en pantalla grande (TV/proyector) sin afectar la lógica ni el flujo de pasos.

**Objetivo**:
- Evitar composición "desparramada" en pantallas muy anchas.
- Mejorar legibilidad a distancia en 1080p/QHD/4K.
- Reducir riesgo de recorte vertical en resoluciones de portátil frecuentes (1366x768, 1536x864, 1600x900).

**Cambios**:
- `static/style.css`:
  - Nuevo bloque `@media (min-width: 1200px) and (max-height: 900px)` para compactación vertical suave (padding/gaps/tipografías/terminal/QR).
  - Nuevo bloque `@media (min-width: 1920px) and (min-height: 960px)` para limitar ancho útil y recentrar contenido en proyector/TV Full HD+.
  - Nuevo bloque `@media (min-width: 2560px) and (min-height: 1200px)` con escalado tipográfico controlado para 4K/ultrawide.
- Sin cambios en JS de navegación ni en la orquestación de pasos.

Versionado sync → v23.16.11.

## v23.16.10 — 2026-04-25 — Fix observación "medium" del reviser: deep-link diapo5 en móvil
El reviser detectó que tras v23.16.9 el handler del deep-link `?screen=diapo5` seguía procesando `stepParam` y llamando a `_diapo5SyncStep` / `_diapo5RunStep` incluso cuando `showDiapo5Screen()` había hecho bypass a diapo 6 por estar en móvil.

Impacto: en móvil se disparaba trabajo innecesario (setTimeout del terminal, swap de clases en DOM oculto) y `_diapo5Step` quedaba desincronizado.

**Fix**:
- `static/app.js`: tras `showDiapo5Screen()` en el handler del deep-link, guarda `if (!isOnDiapo5Screen()) return;`. Si la diapo 5 no quedó activa (bypass móvil), no se ejecuta el bloque del snap ni el sync de step.

Versionado sync → v23.16.10.

## v23.16.9 — 2026-04-25 — Cierre 4 observaciones del reviser
Atiende las 4 observaciones pendientes del reviser sobre v23.16.8:

**1) Deep-link `?screen=diapo5&step=N` sincroniza estado interno**
- Problema: se guardaba `window._diapo5StepOverride` pero nunca se usaba para alinear `_diapo5Step`. Resultado: visualmente saltabas al paso N pero las flechas creían estar en paso 1.
- Fix: nueva función `_diapo5SyncStep(n)` que actualiza directamente la variable module-level `_diapo5Step`. El deep-link ahora llama `_diapo5SyncStep(stepParam)` en el snap. `diapo5NextStep`/`diapo5PrevStep` parten del paso correcto.

**2) Snap del deep-link instantáneo (sin animación slide)**
- Problema: al aplicar `is-active` al paso destino, se disparaba la transición CSS de 700ms. Si el headless capturaba antes, veías contenido del paso anterior.
- Fix: nueva clase `.diapo5-stage--no-transition` que aplica `transition: none !important` a todos los steps. El deep-link la añade, hace el swap de clases, fuerza reflow con `void stage.offsetHeight`, y la quita en 2 `requestAnimationFrame` para restaurar animaciones en flechas posteriores.

**3) Legacy `#blinda-screen` eliminado del DOM**
- Problema: bloque de 40 líneas quedaba oculto en el HTML con `display:none` + `data-legacy="true"`. Clutter en el DOM.
- Fix: eliminado completo el `<main id="blinda-screen">` con toda su estructura interna (header legacy, blinda-demo, blinda-demo__stepper, demo-step-1/2/3). Sustituido por un comentario explicativo.
- Refs JS: `elements.blindaScreen?.` y `elements.blindaScreen && ...` siguen funcionando (defensivos con null).

**4) Criterio de cierre a nivel código verificado**
- `?screen=diapo5` → `showDiapo5Screen()` → `_diapo5Step = 1`, paso 1 con `is-active`, morph arrancado.
- `?screen=diapo5&step=N` → snap inmediato al paso N, `_diapo5Step = N`, animación interna del paso destino.
- Flechas ← / → tras deep-link: usan `_diapo5Step` sincronizado, navegación coherente.
- Header: regla `#diapo5-screen > .slide-header { position: fixed !important; z-index: 9999 !important; }` garantiza visibilidad independientemente de stacking contexts internos.

Versionado sync → v23.16.9 (index.html CSS+JS, encuesta.html, juego3_mobile.html).

## v23.16.8 — 2026-04-25 — Diapo 5: refactor estético completo + Eliana contextualizada
Consolida los cambios v23.16.6, v23.16.7 y v23.16.8 (estos dos últimos no se habían commiteado individualmente). Tras varias rondas de feedback del usuario rehaciendo decisiones de UX:

**1) Header DEFINITIVAMENTE visible** (era v23.16.6)
- `static/style.css`: regla defensiva `#diapo5-screen > .slide-header { position: fixed !important; z-index: 9999 !important; display: flex !important; }`. El reviser confirmó que tras v23.16.5 el header seguía invisible (algún descendiente creaba stacking context). Verificado headless con `Google Chrome --headless=new "http://localhost:9000/?screen=diapo5"`.
- `static/app.js`: deep-link `?screen=diapo5` (con sub-param `&step=N` para saltar a paso N en debug, snap directo sin transición).

**2) Layout más grande y aireado** (era v23.16.7)
- Hook ELITE: 32px → `clamp(32px, 3.6vw, 56px)`, max-width 1280, highlighter mostaza al 42% más visible.
- Pre-text: 26px → `clamp(24px, 2.2vw, 38px)` violeta `#6B2F6D`.
- Post-text: 16px → `clamp(16px, 1.3vw, 22px)`.
- Morphing-text "Pedagogía": 132px → `clamp(72px, 11vw, 180px)`, height aumentada, text-shadow más profundo.
- Flechas laterales overlay grandes (caret-left/right en círculos blancos translúcidos sobre los lados, hover sólido mostaza). Más visibles que las del header. Listeners separados (`diapo5-side-prev`/`next`).
- Light-rays de fondo más visibles: opacidad mostaza 0.10→0.22, lavanda 0.12→0.28, menta 0.30→0.55. Animación drift 18s.

**3) Transiciones SLIDE HORIZONTAL** (en vez de fade-blur)
- `.diapo5-step` default: `translateX(100%) opacity:0 blur(8px)`. Active: `translateX(0)`. Leaving: `translateX(-100%)`. Total 700ms cubic-bezier(.22,1,.36,1).
- Padding de cada paso: 32px 80px (más aire), gap 36px.

**4) Paso 2 — SPLIT CENTRAL (propuesta B aprobada por el usuario)** (era v23.16.8)
- Eliminado el container-text-flip 3D ("absurdo, no explica nada" — feedback del usuario).
- Nueva estructura: grid 3 columnas con línea mostaza horizontal conectando.
  - Izq: card "Profesor" (icon `ph-chalkboard-teacher`, lista con 4 frases concretas con tu rúbrica/glosario/nivel).
  - Centro: agente unificador en círculo mostaza pulsante (3s ease-in-out) con label "UN MISMO AGENTE".
  - Der: card "Alumno" (icon `ph-graduation-cap`, lista con 4 frases — practica a las 23h, repite el subjuntivo sin perder la calma, etc.).
- JS: eliminadas constantes `DIAPO5_FLIP_PAIRS`, `DIAPO5_FLIP_INTERVAL_MS` y funciones `_diapo5StartFlip`/`_diapo5StopFlip`. Paso 2 es estático ahora.

**5) Paso 3 — Terminal con 2 columnas paralelas PROFE | AGENTE**
- Cada letra ELITE ocupa un bloque grid (head full-width arriba; sub-profe izq + sub-agente der debajo).
- PROFE en lavanda `#D0AAD1`, AGENTE en mostaza `#C9A632`. Border-left de 3px del color correspondiente.
- Typing por fases: head → sub-profe → sub-agente, ~30ms/char + 320ms entre líneas.
- Texto de "Elegante" agente corregido: "entrega siempre pulido" → "entrega siempre" (feedback usuario).

**6) Paso 4 — QR mucho más grande**
- 240px → `clamp(320px, 36vw, 440px)` (similar al QR de la diapo 2 que llega a 460px).
- Card neón `padding: 56px 64px 48px`, título `clamp(30px, 3.4vw, 52px)`, sub `clamp(20px, 1.6vw, 26px)`.

**7) Eliana global flotante + Hook permanente arriba**
- En CADA paso de la diapo 5 aparece arriba el hook "Eres un profe ELITE. Tus agentes lo serán también." con highlighter sobre ELITE.
- Eliminado el orb decorativo del paso 4 (`.diapo5-eliana-orb { display: none !important; }`).
- En su lugar, `showDiapo5Screen()` activa el widget global `.eliana-widget` (mismo orb arrastrable de las otras diapos).
- Patrón copiado de `juego3`: `setWidgetState('fab')` + `initWidgetListeners()`.

**8) Eliana habla del CONTENIDO de la diapo 5, no del juego**
- Nuevo prompt `diapo5` en `main.py` (`_DEFAULT_PROMPTS["diapo5"]` y añadido al filtro `ACTIVITY_PROMPTS`). Define: la diapo NO es un juego, los 4 pasos (ingredientes / dualidad / ELITE / comunidad), de qué hablar (mensaje, dualidad, acrónimo, comunidad Hablandis), de qué NO hablar (chef, 8 agentes, MIAU, juego), tono y reglas de español correcto.
- `sendBlindaMessage` (función del widget) ahora elige `activity_mode` dinámico: `'diapo5'` si `isOnDiapo5Screen()`, sino `'juego3_chat'`.
- Mensaje inicial del chat al entrar a la diapo 5: "Hola, soy Eliana. Esta diapo trata de algo concreto: tú ya tienes lo que un agente necesita — pedagogía, MCER, tu estilo. Un mismo agente sirve para ti como profe y para tu alumno. Pregúntame por la dualidad, por ELITE o por la comunidad." Reset del chat al entrar para que no quede el saludo de juego3.

**Pendiente / consciente**
- `docs/diapo5-spec.md` queda muy stale (describe la versión 4 zonas 2×2 anterior). Reescribir cuando el diseño se congele.
- `docs/diapo-ia-para-estudiantes.md`, `docs/diapo-ia-para-profes.md`, `docs/diapo-pildoras-formativas.md` quedan como untracked, no se incluyen en este commit.
- Versionado sincronizado en los 3 ficheros visibles → v23.16.8.

## v23.16.6 — 2026-04-25 — Diapo 5: fix DEFINITIVO del header + deep-link
El reviser confirmó que tras v23.16.5 el header seguía sin verse en runtime, aunque el código declaraba el fix. Causa real: algún ancestro del header `.slide-header` (probablemente el `.diapo5-stage` por las animaciones internas con filter/transform) creaba stacking context que dejaba al fixed header invisible o detrás.

**Fix con verificación headless**:
- `static/style.css`: nueva regla defensiva `#diapo5-screen > .slide-header { position: fixed !important; top: 0 !important; ...; z-index: 9999 !important; display: flex !important; }`. Garantiza que, sin importar lo que hagan los descendientes del `.diapo5-screen`, el header queda anclado al viewport con z-index máximo.
- `static/app.js`: añadido `else if (screenParam === 'diapo5') showDiapo5Screen()` al deep-link handler para poder abrir directamente con `?screen=diapo5`. Esto permitió tomar screenshots headless con Chrome y validar el fix antes de pedir confirmación al usuario.

**Verificación**:
- Comando: `Google Chrome --headless=new --window-size=1600,900 --screenshot=/tmp/diapo5_step1.png "http://localhost:9000/?screen=diapo5"`.
- Resultado: header mostaza visible con número 05, título "Saca el agente que llevas dentro", flechas back/next. Paso 1 con morphing-text "Pedagogía" centrado. Caption inferior con la lista de ingredientes. Layout coherente.

Versionado sync → v23.16.6.

## v23.16.5 — 2026-04-25 — Diapo 5 fix: header tapado por el stage
Bug del rediseño v23.16.4: el `.slide-header` (franja mostaza con título y flechas) no se veía en la diapo 5. Causa: el `.diapo5-screen` con `overflow: hidden` + `transition: transform` estaba creando un containing block para el header `position: fixed` (comportamiento de algunos navegadores al promover capas), recortándolo.

**Fix**:
- `.diapo5-screen`: quitado `overflow: hidden` (innecesario), eliminado `transition: transform` (solo opacity), añadido `padding: 78px 0 0 0 !important` (igual que `.blinda-page--fullscreen` con su 72px) y `display: flex; flex-direction: column;`. La `.fade-out` ahora solo afecta a `opacity`, no a `transform`.
- `.diapo5-stage`: pasa de `min-height: 100vh + padding-top: 78px` a `flex: 1` dentro del flex column del screen. `overflow: hidden` se queda en el stage para recortar los steps absolutos.
- `.diapo5-step`: `inset: 78px 0 0 0` → `inset: 0`. Ahora el stage ya está offsetted desde el padding del screen.
- Media query `@media (max-height: 760px)`: actualizada para mover el padding-top al screen (no al stage).

Versionado sync → v23.16.5.

## v23.16.4 — 2026-04-25 — Diapo 5: rediseño completo en 4 pasos secuenciales
Tras el feedback duro del usuario sobre v23.16.0-3 ("una diapo 2×2 apretada con cuatro recuadros pegados rompe el estilo de la presentación, no usa los UIs de sgel que te pasé"), se rehace toda la diapo 5 como una **secuencia de 4 pasos full-screen** con transiciones fade-blur entre uno y otro, avance manual con flechas, sin indicador de progreso. Cada paso usa un UI diferente de sgel adaptado a vanilla JS.

**Estructura**
- `.diapo5-stage` con `position: relative` y `light-rays` decorativos de fondo (radial-gradients drift 18s).
- 4 `<section class="diapo5-step" data-step="1..4">`. Solo uno con `is-active` a la vez. Transición 600ms cubic-bezier(.22,1,.36,1) para opacity + filter blur(14px) + translateY 40px.

**Pasos**
1. **Ingredientes** — `morphing-text` con `requestAnimationFrame`. Palabra GIGANTE 132px Dosis #8A6A1C que se transforma a la siguiente con blur cycling. Pre/post text estáticos.
2. **Dualidad** — `container-text-flip` 3D. Caja central con dos caras (front mostaza "EN CLASE", back violeta "CON TU ALUMNO") rotando en X cada 3.5s. Frase-ejemplo debajo cambia con blur en sync.
3. **ELITE** — `terminal` typing. Pseudo-terminal macOS (3 dots, título) tecleando 5 líneas con cursor parpadeante. Spans coloreados: prompt mostaza, letra mostaza bold, palabra blanca bold, glosa gris itálica. Velocidad ~30ms/char + pausas 280ms entre líneas.
4. **Comunidad + QR** — `neon-gradient-card`. Card con border gradient cónico animado (8s loop con `@property --neon-angle`), inner blanco. QR Hablandis 168px + orb de Eliana 120px lado a lado.

**Navegación**
- `diapo5-nav-next` → `diapo5NextStep()`. En el paso 4 hace fade-out + `showDiapo6Screen()`.
- `diapo5-nav-back` → `diapo5PrevStep()`. En el paso 1 hace `hideDiapo5Screen()` y vuelve a la diapo 3.

**Limpieza**
- Eliminados: `DIAPO5_CHIP_WORDS`, `DIAPO5_CHIP_INTERVAL_MS`, `DIAPO5_TTS_TEXT`, `initDiapo5ChipRotator/rotate/stop`, `initDiapo5Reveals`, todo el highlighter del hook ELITE viejo, focus cards, slogan highlight, lista ELITE acrónimo apretada, hook fixed.
- Eliminado el TTS automático al abrir (Eliana ya no habla en esta diapo — Román lleva la narración paso a paso).
- Estado limpio: variables module-level `_diapo5Step`, `_diapo5MorphRAF`, `_diapo5FlipTimer`, `_diapo5FlipIndex`, `_diapo5TerminalTimer`.

**Ficheros**
- `static/index.html`: bloque `<div class="diapo5-stage">` reescrito con 4 sections.
- `static/style.css`: 420 líneas reemplazadas (todo el bloque diapo 5).
- `static/app.js`: bloque diapo 5 reescrito completo + listeners de las flechas → `diapo5PrevStep`/`diapo5NextStep`.
- `CLAUDE.md`: sección protección diapo 5 actualizada con la nueva estructura de 4 pasos.
- Versión sync v23.16.3 → v23.16.4 en index, encuesta, juego3_mobile.

**Pendiente / consciente**
- `docs/diapo5-spec.md` queda stale — describe la versión 2×2 anterior. Reescribir cuando el diseño se congele.
- TTS desactivado en esta diapo. Si se quiere reintroducir, decidir cuándo (¿paso 1 al abrir? ¿en cada paso? ¿solo paso 4?).
- El reviser debe validar: contraste paso 3 (terminal oscuro sobre fondo claro), accesibilidad de las transiciones (`prefers-reduced-motion`), `@property --neon-angle` (Safari ≤15 no soporta — fallback aceptable).

## v23.16.3 — 2026-04-25 — Diapo 5: cambio de título (paso 1 de rediseño)
Usuario inicia un rediseño paso a paso de la diapo 5 (considera el actual un desastre). Primer paso: cambiar el título del header mostaza.

- `static/index.html`: `slide-header__text` de `#diapo5-screen` pasa de "Sacas lo que llevas dentro" a "Saca el agente que llevas dentro".

Resto de la diapo 5 intacto pendiente de las decisiones del usuario sobre hook, dualidad profe/alumno, ELITE y transiciones.

Versionado sincronizado → v23.16.3.

## v23.16.2 — 2026-04-25 — Atajo diapo 3 → diapo 5 (permiso explícito del usuario)
Durante el ensayo, el usuario detectó que no tenía una flecha clara para saltar de la diapo 3 a la 5 sin atravesar la diapo 4 (juego de equipos). Autoriza modificar la diapo 3 para añadir un atajo.

**Cambio**
- `static/index.html`: nuevo botón `#juego3-skip-to-5-btn` al final de `.juego3-page`, fuera de las secciones internas (idle/play/ended/eliana). Texto "Saltar a diapo 5 →".
- `static/style.css`: nueva clase `.juego3-skip-btn` — pill flotante `position: absolute; bottom: 18px; right: 22px;` con fondo blanco translúcido + borde mostaza + hover sólido mostaza. Responsive reducido en ≤720px.
- `static/app.js`: listener en el bloque de juego3 que hace `hideJuego3Screen()` + `setTimeout(() => showDiapo5Screen(), 300)`.
- `CLAUDE.md`: ampliada la sección de protección de diapo 3 incluyendo el nuevo botón como parte del scope protegido.

**Por qué no modifica la diapo 4**
El usuario quería un atajo visible y explícito en la diapo 3 (punto de decisión natural), no arreglar flechas dentro de la diapo 4 — que sigue protegida y funcional para el flujo completo cuando se juegue en equipos.

Versionado sincronizado → v23.16.2.

## v23.16.1 — 2026-04-25 — Diapo 5: 3 ajustes obligatorios del reviser
Aplicados los 3 obligatorios del informe del reviser sobre v23.16.0:

1. **CLAUDE.md sección diapo 5 reescrita** — la protección describía el diseño viejo del chef (DIAPO5_CAPABILITIES, renderDiapo5WordCloud, cancion-agente.mp3, ACTIVITY_PROMPTS["agentes"]), haciéndose auto-contradictoria al proteger código que ya no existe. Reescrita al diseño ELITE: enumera las funciones/constantes nuevas, el HTML/CSS actual, el texto TTS exacto, la URL del QR, la dependencia qrcode-generator, el bypass móvil y el spec. Un bloque final lista el legacy no protegido (el prompt "agentes" huérfano en main.py y cancion-agente.mp3) pendiente de eliminar.

2. **Guarda anti-fuga en chip rotator** (`static/app.js`) — `rotateDiapo5Chip()` ahora comprueba `isOnDiapo5Screen()` al entrar y llama `stopDiapo5ChipRotator()` si el usuario ha navegado fuera por un path que solo oculte con `classList.add('hidden')` sin pasar por `hideDiapo5Screen()` ni `diapo5-nav-next`. Evita que un `setInterval` modifique un nodo oculto indefinidamente.

3. **z-index del highlighter ELITE blindado** (`static/style.css`) — `.diapo5-hook__title` ahora declara `position: relative; z-index: 0` para crear stacking context explícito. El pseudo-elemento `::after` del highlighter (que usa `z-index: -1`) se queda dentro de ese contexto y no puede ser sepultado por un ancestro con stacking context accidental.

Versionado sincronizado en los 3 ficheros visibles → v23.16.1.

## v23.16.0 — 2026-04-25 — Diapo 5 rewrite: "Eres un profe ELITE"
Reescritura completa de la diapositiva 5. Se sustituye la metáfora del chef (10 pasos guiados por chat con Eliana + canción) por una diapositiva estática, densa y autónoma con foco narrativo en el profesor.

**Concepto**
- Hook: "Eres un profe ELITE. Tus agentes lo serán también. / Lo que harán por ti · para ti · contigo."
- 4 zonas en grid 2×2 (tras el hook a ancho completo):
  - **Zona A** — "Ingredientes que SOLO tú tienes" con chip rotator animado (Pedagogía, Lingüística ELE, MCER, Errores por L1, Cultura, Empatía, Tu estilo — cambia cada 2.5s con blur in/out).
  - **Zona B** — Focus cards "Contigo, en clase" vs "Después, con tu alumno" (hover desenfoca la otra) + slogan "Construyes una vez. Se usa dos veces." con highlighter lavanda.
  - **Zona C** — Comunidad: "¿Por qué no sacas ese agente que llevas dentro?" + QR dinámico al form de Hablandis + orb de Eliana decorativo en esquina.
  - **Zona D** — Acrónimo ELITE como revelación final: Empático · Leal · Intuitivo · Tenaz · Elegante (stagger 200ms por letra vía IntersectionObserver, con fallback).

**TTS** — Eliana dice SOLO el hook+subtitulo al abrir la diapo (400ms de delay). Román continúa en persona. No hay chat, no hay wake-word, no hay auto-avance por keywords.

**Cambios técnicos**
- `static/index.html`: reemplazado el bloque `#diapo5-screen` completo. Nueva estructura con `slide-header` + `.diapo5-page` (grid-template-areas "hook hook / a b / c d") + cuatro `.diapo5-zone` + lista `.diapo5-elite-list` con 5 items.
- `static/style.css`: eliminados todos los estilos legacy de la metáfora del chef (`.diapo5-demo*`, `.diapo5-wordcloud*`, `.diapo5-chef-intro*`, `.diapo5-cap*`, `.diapo5-closing*`, `.diapo5-song*`, responsive antiguo). Añadidos `.diapo5-hook`, `.diapo5-hook__elite` (con highlighter amarillo), `.diapo5-zone*` base + por zona, `.diapo5-chip-rotator` + keyframes `diapo5ChipOut`/`diapo5ChipIn`, `.diapo5-focus-grid` (hover: `:hover ~` blur siblings), `.diapo5-highlight` (slogan con lavanda), `.diapo5-elite-item` (reveal con `transform: translateX(-14px) → 0`). Paleta v23: mostaza #C9A632 + profundo #8A6A1C, lavanda #D0AAD1, violeta #6B2F6D para acentos.
- `static/app.js`: eliminado todo el bloque legacy (DIAPO5_CAPABILITIES, DIAPO5_CLOUD_WORDS, DIAPO5_KEYWORD_MAP, renderDiapo5WordCloud/Intro/Capability/Closing/Song, advanceDiapo5To, checkDiapo5Advance, sendDiapo5Message, addDiapo5ChatBubble, state.diapo5Step/_diapo5Ws/_diapo5ContextSent/_diapo5SmdParser, listeners de diapo5-chat-send/diapo5-chat-input/diapo5-mic-btn/diapo5-voice-btn/[data-diapo5-dot], el diapo5MicBtn en updateRecordingUI, diapo5-voice-btn en el array de updateVoiceButtonsUI, la rama diapo5 en el handler de wake-word y la rama en processTranscription). Añadidas las constantes DIAPO5_CHIP_WORDS, DIAPO5_CHIP_INTERVAL_MS, DIAPO5_COMMUNITY_URL, DIAPO5_TTS_TEXT y las funciones `showDiapo5Screen`, `hideDiapo5Screen`, `isOnDiapo5Screen`, `initDiapo5ChipRotator`/`rotateDiapo5Chip`/`stopDiapo5ChipRotator`, `initDiapo5QR` (usa `window.qrcode` ya cargado), `initDiapo5ElianaOrb` (usa `window.orbCreateInElement`), `initDiapo5Reveals` (IntersectionObserver + fallback 1.5s).
- Versionado sincronizado en los 3 ficheros visibles → v23.16.0 (`index.html` CSS+JS, `encuesta.html` footer, `juego3_mobile.html` footer).
- CLAUDE.md: sección de protección de diapo 5 queda stale y debe reescribirse con el usuario antes de bloquear de nuevo. Protegemos el nuevo código en la siguiente iteración (no en este commit).

**Lo que NO cambia**
- Diapos 1-4 y 6 intactas.
- `ACTIVITY_PROMPTS["agentes"]` en `main.py` permanece por ahora (ya no se usa desde el front, pero se mantiene hasta confirmar con el reviser que se puede eliminar — low-risk diferir).
- `static/cancion-agente.mp3` permanece en el repositorio (no referenciado desde el código activo).

## v23.15.1 — 2026-04-25 — Fix doc consistency §10-ter tras cierre reviser
Residuo documental señalado por el reviser:
- **`docs/juego3-spec.md` §10-ter** aún decía "Layout 3 columnas en `.juego3-eliana`: orb | cuerpo | tabla", contradiciendo la §10 que ya reflejaba el nuevo layout de 2 columnas (v23.15.0). Corregido: §10-ter ahora dice "Layout 2 columnas (v23.15.0+)" con nota sobre la eliminación del orb central.

**Verificación CSS residual** (reviser mencionó `style.css:10227`): comprobado — NO hay regla residual de `.juego3-eliana__orb` en el CSS. Solo queda la regla defensiva `.juego3-eliana__orb { display: none; }` en línea 9850, que es intencional para prevenir render accidental si un flujo legacy inyecta el nodo. Los otros "orb" en el archivo son `.eliana-widget__*` (widget flotante, debe seguir existiendo) y un comentario de diapo 4 legacy.

Sin cambios de código. Versionado sincronizado en los 3 ficheros visibles → v23.15.1.

## v23.15.0 — 2026-04-25 — Pantalla final Eliana: sin orb central + prompt con agrupación
Usuario reportó dos problemas visuales/narrativos en la pantalla final tras 5 cartas:
1. **Orb central redundante**: el widget flotante ya representa a Eliana visualmente. Un orb basta.
2. **Texto repetitivo**: 4 frases seguidas "les salió bien / les fue bien" cuando 4 cartas fueron idénticas. Sonaba robótico. El prompt forzaba "5 líneas, una por carta" sin permitir agrupar resultados similares.

Revisión aplicada con ajustes del reviser (aprobado con cambios):

**UI (2 columnas, sin orb central)**:
- HTML: quitado `<div class="juego3-eliana__orb">` de `#juego3-eliana-screen`.
- CSS: `.juego3-eliana` pasa de 3 cols a 2 cols (`body` + `results`). `__body` ancho 520→640px, `gap` 36→48px, `min-width` 360→400px. Regla defensiva `.juego3-eliana__orb { display: none }` por si algún flujo legacy renderiza el nodo. Responsive <1200px y <720h sin referencias al orb.
- JS: la inicialización del orb en `startJuego3ElianaFinal` se condiciona al `document.getElementById('juego3-eliana-orb')` — si el host no existe, no se crea. **El campo `juego3.elianaOrb` del state se mantiene** como null defensivo (recomendación del reviser: no tocar si no es necesario).

**Prompt (Bloque B permite agrupar)**:
- Reescrito el Bloque B en `juego3_final`. Ya no fuerza "5 líneas, una por carta". Nueva regla: "Menciona las 5 cartas EN ORDEN pero AGRUPA cartas consecutivas con resultado parecido en una sola frase".
- Reglas específicas: cartas perfectas (100%) se agrupan salvo matiz pedagógico; 3+ cartas similares en una sola frase; las cartas con confusión real merecen mención individual.
- Anti-repetición por principio (reviser): "no repetir estructura sintáctica / verbos / plantillas" en lugar de listas cerradas de vocabulario permitido/prohibido (más estable con el LLM).
- **Regla gramatical específica**: "Ha habido" (nunca "han habido") — corrige el error observado en el test de v23.14.0.
- Prohibición explícita de "porcentaje alto/bajo de aciertos" — usar proporciones humanas.

**Spec + CHANGELOG**: §10 y §10-ter actualizados con la nueva regla de agrupación. Versionado sincronizado en los 3 ficheros visibles → v23.15.0.

## v23.14.2 — 2026-04-24 — Fix 2 inconsistencias doc residuales del spec
Tras la revisión final del reviser sobre v23.14.1, quedaban 2 inconsistencias documentales menores pero reales:

1. **§10 del spec describía a Eliana como "3-5 frases + highlights mejor/peor"** — regla antigua de v23.13.0 que contradice la nueva §10-ter (3 bloques A/B/C, 8 líneas máx). QA o futuro mantenedor podía leer reglas distintas según qué sección mirase. Resuelto: §10 ahora resume la estructura A/B/C con referencia cruzada a §10-ter como fuente detallada. §10-ter sigue siendo la fuente de verdad completa.

2. **Dos referencias stale a v23.13.0**: header del spec (`Última actualización: v23.13.0`) y pie de sección "Archivos ejecutivos" (`CHANGELOG.md # entrada v23.13.0`). Cambiado el header a `v23.14.2` y el pie a descripción genérica (`historial de cambios por versión`) para evitar que envejezca.

Sin cambios funcionales. Versionado sincronizado en los 3 ficheros visibles → v23.14.2.

## v23.14.1 — 2026-04-24 — Fix doc consistency + test manual panel resultados
Dos correcciones menores tras revisión v23.14.0:
- **Fix inconsistencia doc**: sección §10 del spec decía `max_tokens=350` mientras que la §10-ter nueva decía `360`. Unificado a 360 en ambas, con referencia cruzada a §10-ter como fuente de verdad.
- **Nuevo test manual en §10-bis**: "Test manual: summary ausente al abrir pantalla final" con pasos exactos para validar que el panel de resultados se oculta correctamente cuando `juego3.summary` es null y que el CTA no se rompe. Incluye el subcaso del fetch fallido.

Sin cambios de código — solo documentación.

Versionado sincronizado en los 3 ficheros visibles → v23.14.1.

## v23.14.0 — 2026-04-24 — Eliana final estructurada + panel de resultados detallados
Propuesta del usuario aprobada por reviser (con ajustes). Implementada Opción A (extender pantalla Eliana), sin tocar diapo 4 legacy aunque el permiso estaba levantado.

**Parte 1 — Prompt `juego3_final` semi-blindado** (main.py):
Reescrito con estructura obligatoria en 3 bloques pero lenguaje libre dentro:
- **Bloque A** (1-2 frases): resumen global.
- **Bloque B** (5 líneas, 12-14 palabras c/u): repaso por cada carta, mencionando confusión si aplica.
- **Bloque C** (1 frase): cierre-puente a la siguiente diapositiva.

Límites estrictos: máximo 8 líneas, sin porcentajes crudos repetidos, tono jovial NO infantil. `max_tokens` subido a 360 (primera iteración conservadora; 400 queda para segunda si hace falta).

Rama especial si `cartas_jugadas == 0` o `votos == 0`: Eliana rompe la estructura y da mensaje amable único.

**Parte 2 — Panel de resultados detallados en `.juego3-eliana`**:
- HTML: nuevo `<aside id="juego3-eliana-results">` dentro de la pantalla Eliana final.
- Layout 3 columnas: orb | cuerpo (texto streaming) | tabla de resultados.
- Contenido: 5 filas con número + concepto + barra horizontal de `pct_acierto` + ratio numérico (`aciertos/votos`). Badge "Confundieron con X" solo si `pct_acierto < 60` y `confusion_dominante` presente.
- Total al pie: `aciertos/votos` + `pct` grande en verde.
- Datos: `juego3.summary.por_carta[]` + `juego3.summary.global`. Sin nuevo endpoint.
- **Si `cartas_jugadas == 0` o no hay `por_carta`**: panel completamente oculto, no placeholders vacíos (DoD del reviser).

**Revelado progresivo** (propuesta reviser para evitar saturación):
- Contenedor: fade-in + translateY 10px→0 tras 350ms del render.
- Filas: aparición escalonada con stagger de 80ms entre filas.
- Barras: `scaleX(0→1)` con `cubic-bezier(0.22,1,0.36,1)` en 600ms, delay extra de 200ms tras su fila.

**Responsive <1200px**: layout en columna (orb arriba, cuerpo, tabla abajo), scroll vertical.

**Spec técnica** `docs/juego3-spec.md` ampliada con sección 10-ter (estructura del prompt + diseño del panel + DoD completos).

**No se tocó diapo 4** a pesar de que el usuario liberó la protección: la opción A (extender pantalla existente) fue mejor que tocar código legacy de Blinda.

Versionado sincronizado en los 3 ficheros visibles → v23.14.0.

## v23.13.12 — 2026-04-24 — Fix race condition en TTS (carta 2 se cortaba/duplicaba)
Bug reportado por el usuario: en la carta 2, la lectura TTS de Eliana a veces se corta, se queda colgada unos segundos, y luego se reproduce (o se duplica). Pasaba 2 de cada 5 veces.

Diagnóstico del reviser (confirmado en código): `playTTS` usaba un flag global `state.ttsCancelled` que cualquier llamada podía resetear a `false`, permitiendo que peticiones "canceladas" resucitaran si eran más lentas que la siguiente.

Escenario típico:
1. Carta 1 llama `playTTS` → `fetch /api/tts` lento.
2. Antes de que vuelva, carta 2 llama `playTTS`.
3. Carta 2 hace `stopTTS` → `ttsCancelled=true`. Pero inmediatamente resetea a `false`.
4. Fetch de carta 1 vuelve, ve `ttsCancelled=false`, reproduce audio ANTIGUO.
5. Fetch de carta 2 vuelve, reproduce encima o tras el de carta 1.

**Fixes aplicados**:

- **Fix #1 — Token por petición** (propuesta del reviser): `state.ttsRequestId` incremental. Cada llamada captura `const myId = ++state.ttsRequestId`. En cada await (fetch, blob, play), verifica `state.ttsRequestId === myId`. Si no, aborta. `stopTTS()` incrementa el contador → invalida todas las peticiones en vuelo instantáneamente.
- **Fix #2 — Lock por carta** en `triggerJuego3CardTTS`: flag `_juego3TTSInFlight` evita que si ya hay un TTS en vuelo para la carta actual, se dispare otro (caso edge de state WS repetido o doble click). Se libera automáticamente tras completar o al reset del juego.
- **Fix #4 — Logs observables** con prefijos:
  - `[tts_card_start] card=N` — se programa la lectura.
  - `[tts_card_play] card=N req=X` — se dispara playTTS.
  - `[tts_card_abort_stale] card=N current=M` — la carta cambió durante el delay.
  - `[tts_card_skip] card=N reason=...` — doble-fire bloqueado.
  - `[TTS] req=X stale after fetch — aborted` — petición obsoleta abortada.

Versionado sincronizado en los 3 ficheros visibles → v23.13.12.

## v23.13.11 — 2026-04-24 — Donut acumulativo en el panel del proyector
Dos gráficos ahora en el panel derecho durante `phase=revealed`:

1. **Por pregunta** (ya existía): barras horizontales por tipo de IA (chatbot / asistente / agente) con el agente destacado en verde.
2. **Acumulativo (nuevo)**: donut debajo que muestra el % de aciertos de agente agregado sobre el total de votos de todas las cartas jugadas.
   - Centro del donut: pct grande (ej. `65%`) + "Aciertos" debajo.
   - Leyenda a la derecha: `X aciertos de agente` (verde) + `Y confusiones` (violeta) + contador de cartas jugadas `3 / 5 cartas`.
   - Implementado con `conic-gradient` CSS (sin dependencias JS externas).
   - Se actualiza en cada reveal cuando llega un nuevo `summary` por WS.
   - Fallback: si aún no hay `juego3.summary`, calcula desde el tally de la carta actual para que muestre algo coherente.

Caso de uso didáctico: el grupo ve en vivo cómo va su comprensión del concepto "agente" a medida que avanzan las 5 cartas.

Versionado sincronizado en los 3 ficheros visibles → v23.13.11.

## v23.13.10 — 2026-04-24 — Botón visible "Reiniciar juego" en el proyector
No había forma de resetear el juego desde la UI sin recargar la página entera. Añadido botón discreto "Reiniciar juego" en la columna izquierda del proyector, debajo de Revelar/Siguiente.
- Estilo terciario (dashed border violeta tenue) — no compite con los botones primarios.
- `confirm()` antes de ejecutar para evitar reset accidental durante taller real.
- Envía `{type:"reset"}` por el WS del dashboard. Backend limpia estado + `votes_by_participant`. Todos los móviles detectan `phase=idle` y limpian sus localStorage (v23.13.9).

Caso de uso: tests repetidos durante desarrollo + repetir el juego con otro grupo sin recargar.

Versionado sincronizado en los 3 ficheros visibles → v23.13.10.

## v23.13.9 — 2026-04-24 — Auto-clear de votos locales al reset del servidor + dev helpers móvil
Problema para testing: el dedup server-side + localStorage impedía que el mismo móvil votara la misma carta dos veces — correcto en taller real pero bloqueaba pruebas repetidas.

Fix:
- **Móvil — auto-clear**: cuando el servidor vuelve a `phase='idle'` (reset por el presentador), el cliente limpia automáticamente `state.votedCards` + `localStorage.juego3_votes`. Así, tras un reset del juego, cualquier móvil puede volver a votar sin fricciones.
- **Dev helpers en móvil** (accesibles desde DevTools del navegador):
  - `juego3DevClearMyVote()` — borra identidad (participant_id) + votos locales. Recargar después para generar UUID nuevo. Alternativa a modo incógnito.
  - `juego3DevInfo()` — imprime identidad + storage level + votos + estado actual.

Versionado sincronizado en los 3 ficheros visibles → v23.13.9.

## v23.13.8 — 2026-04-24 — Observabilidad: métricas de sesión + dev helpers para tests manuales
Dos mejoras opcionales del reviser:

**Métricas simples de sesión** en `juego3.metrics` (inspeccionable desde DevTools):
- `ultimo_recurso_count` — cuántas veces cayó al texto de último recurso.
- `summary_fetch_fail_count` — fallos del GET `/api/juego3/summary`.
- `llm_error_count` — errores del WS al LLM.
- `ultimo_recurso_reasons[]` — historial con `ts`, `reason` (`llm_error` / `ws_error` / `ws_close_no_end`), `fetch_failed`, `has_local_summary`.

Helper `juego3DevMetrics()` imprime tabla legible en consola.

**Dev helpers para tests manuales** sin tirar red real:
- `juego3DevSimulate('summary_fail')` — intercepta el fetch de summary.
- `juego3DevSimulate('llm_fail')` — intercepta el WS `/ws/chat` y dispara error inmediato.
- `juego3DevSimulate('both_fail')` — combina ambos (test del último recurso).
- `juego3DevSimulate('reset')` — restaura fetch/WebSocket nativos.

Cada call a `ultimoRecurso()` loggea con prefijo `[juego3][metric]` para poder hacer grep en el log del proyector durante taller real.

Spec técnica `docs/juego3-spec.md` ampliada con sección **10-bis Observabilidad y tests manuales** con los comandos exactos.

Versionado sincronizado en los 3 ficheros visibles → v23.13.8.

## v23.13.7 — 2026-04-24 — Eliana final: LLM ahora se intenta aunque falle el fetch HTTP
Observación residual del reviser: si `fetch('/api/juego3/summary')` fallaba (red, endpoint caído transitoriamente), `startJuego3ElianaFinal` asumía "nadie jugó" y mostraba el mensaje fijo. Pero el backend tiene los datos server-side e inyecta el summary en el system prompt al activar `activity_mode=juego3_final` — la devolución del LLM es posible aunque el fetch del cliente no haya conseguido los chips locales.

Cambios:
- Separadas las dos ramas que antes se mezclaban:
  - "Nadie jugó" → SOLO si el fetch devolvió summary válido con `cartas_jugadas === 0` o `votos === 0`. Mensaje amable sin LLM.
  - "Fetch falló" → seguimos al LLM; el backend inyecta el summary desde su propio estado.
- Flag `summaryFetchFailed` + log diagnóstico (`[Juego3] summary HTTP fetch falló — intentando LLM igualmente`).
- Chips fallback (timeout de 2s) ahora solo aparecen si hay summary local. Sin summary y sin LLM, caemos a un **mensaje de último recurso** (nuevo `ultimoRecurso()`): "Habéis terminado las cinco cartas. Ya tenéis la idea — un agente no es un chatbot, ni siquiera un asistente. Pasemos a lo siguiente."
- Deduplicación del manejo entre `onmessage['end']`, `onerror`, `onclose` con flag `handledClose` (evita mostrar "último recurso" dos veces).

Versionado sincronizado en los 3 ficheros visibles → v23.13.7.

## v23.13.6 — 2026-04-24 — Fix: strip de chips no aparece prematuramente
Bug señalado por el reviser: el handler de `summary` en el dashboard llamaba a `renderJuego3ElianaFallback()` sin condiciones, lo que insertaba los chips en el DOM oculto de la pantalla Eliana durante el juego normal (cada reveal emite un summary). Al abrir la pantalla final, el usuario podía ver chips antes de que el LLM fallara o terminara — violación del contrato "fallback solo si LLM timeout/error".

Fix: el handler ahora **solo refresca** el strip si `document.getElementById('juego3-eliana-fallback')` ya existe (es decir, si fue creado por el timeout de 2s en `startJuego3ElianaFinal`). Nunca lo crea desde este camino.

Resultado: el strip aparece exclusivamente en su caso de uso legítimo (LLM tardó o falló). Si existe y llega un summary actualizado, los valores se refrescan; si no existe, no se crea uno nuevo prematuramente.

Versionado sincronizado en los 3 ficheros visibles → v23.13.6.

## v23.13.5 — 2026-04-24 — Feedback WS en hello + "0 de 0" explícito
Dos ajustes del reviser (opcionales, no bloqueantes):
- **Backend**: en `hello`, si el `participant_id` es inválido o ausente, ahora enviamos al móvil un mensaje `{type:"participant_rejected", reason, message}` en el momento, en vez de esperar al intento de voto. Da feedback proactivo al usuario (aunque en la práctica el móvil nunca debería enviar un pid malformado, porque lo genera el propio código).
- **Móvil**: handler para `participant_rejected` que activa `state.participantBlocked = true` y muestra un banner persistente arriba del todo hasta que el usuario recargue.
- **Proyector**: el contador de participación ahora muestra `"0 de 0 han votado"` cuando no hay participantes conectados, en vez del ambiguo `"0 de …"`. Completa el requisito de "N explícito" que quedaba pendiente del Paso 4 original.
- Versionado sincronizado en los 3 ficheros visibles → v23.13.5.

## v23.13.4 — 2026-04-24 — Validación UUID v4 del participant_id + trazabilidad CHANGELOG
Refuerzo de seguridad + housekeeping tras propuesta del reviser:
- **Backend**: nueva función `_is_valid_participant(pid)` valida formato UUID v4 canónico (`8-4-4-4-12` hex con dígito `4` en el tercer grupo y `[89ab]` en el cuarto). Usada en `hello` y en `vote`. Cierra el bypass trivial del dedup donde un cliente malicioso podía rotar strings arbitrarios (`"aaa"`, `"bbb"`) para votar múltiples veces.
- Nuevo motivo de rechazo WS: `reason: "invalid_participant_format"` con mensaje al usuario "Tu identificador no es válido. Recarga la página…".
- Logs backend: `[juego3] hello rejected: invalid participant_id format` + `[juego3] vote rejected: invalid participant format` con `pid_len` para diagnóstico sin exponer el pid.
- **CHANGELOG**: añadidas entradas retroactivas para v23.13.1, v23.13.2 y v23.13.3 que se habían saltado (trazabilidad de release).
- Versionado sincronizado en los 3 ficheros visibles (index, encuesta, juego3_mobile).

## v23.13.3 — 2026-04-24 — Dedup server-side estricto + fallback 3 niveles + "yo vs nadie"
Tras propuesta del reviser "Endurecer deduplicación server-side":
- **Backend**: rechazo estricto de votos sin `participant_id`. Elimina el agujero donde `pid=""` saltaba el dedup — métricas del `summary` ahora fiables al 100%. Nuevo evento WS `{type:"vote_rejected", reason, message}`.
- **Móvil — fallback de 3 niveles** para el participant_id:
  1. `localStorage` (persistente entre sesiones, ideal)
  2. `sessionStorage` (sobrevive solo mientras la pestaña esté abierta)
  3. En memoria (dura hasta recargar)
  `_storageLevel` se logea para diagnóstico. Si cae a memoria, aviso proactivo en UI antes de votar ("Almacenamiento limitado, tu voto podría no sobrevivir a una recarga").
- Handler de `vote_rejected` en el móvil: revierte voto local + muestra banner ámbar con el mensaje del backend.
- Nuevo campo `card_total_votos` en el mensaje `state` (solo en `phase=revealed`).
- Feedback del móvil post-reveal ahora distingue:
  - `cardTotalVotos === 0` → **"Nadie respondió esta vez"**
  - `cardTotalVotos > 0` → **"No votaste esta vez"**
  Más preciso emocionalmente: no culpa al jugador si nadie votó.

## v23.13.2 — 2026-04-24 — Sync version footer en juego3_mobile.html
El móvil `/juego3` mostraba `v23.13.0` mientras desktop + encuesta ya iban a `v23.13.1`. Sincronizados los 3 ficheros visibles a `v23.13.2`. Memoria actualizada con regla explícita: al bumpear versión hay que tocar SIEMPRE `index.html`, `encuesta.html` Y `juego3_mobile.html`.

## v23.13.1 — 2026-04-24 — QR dinámico en diapo 2 apuntando a /juego3
El QR hardcoded (SVG inline de 37×37) de la diapo 2 encodaba un deep link antiguo (`?screen=juego-intro`), cargando la misma diapo 2 en el móvil del jugador. Sin sentido.
- Eliminado el SVG inline. Sustituido por `<div id="jintro-qr-svg">` que se rellena dinámicamente.
- Añadida lib `qrcode-generator@1.4.4` via CDN (jsdelivr).
- Nueva función `renderJintroQRCode()` en `app.js` genera el QR SVG al abrir la diapo 2, apuntando a `${location.origin}/juego3`. Funciona con cualquier deployment (ngrok, producción, local) sin hardcodear URL.
- El destino (`juego3_mobile.html`) es una página standalone **sin navegación** a otras diapositivas — el jugador solo ve el interfaz de voto, no puede ver el resto de la presentación.
- Autorizado puntualmente sobre la diapo 2 protegida (solo el QR).

## v23.13.0 — 2026-04-24 — Móvil rediseñado + chart por tipo + Eliana final con datos reales
Tres cambios sincronizados en diapo 3 (spec técnica en `docs/juego3-spec.md`):

**Móvil (`/juego3`, `static/juego3_mobile.html`)** — reescritura completa:
- Estados claros: idle → voting → waiting (tras voto) → revealed.
- **Elimina spoilers**: fuera `area`, `intro`, `format-badge` y paleta crema mostaza.
- **Feedback personalizado tras reveal**: banner verde `#8CBEB2` "¡Correcto!" (1 explicación) / banner ámbar `#D4826A` "Confundiste X con agente" (2 explicaciones) / banner neutro "No votaste esta vez" (1 explicación). Triple redundancia accesible: icono Phosphor + texto + color.
- Tipografía agrandada: pregunta 26px Dosis 900, opciones 18px, min-height 80px por opción.
- **UUID v4 persistente** en `localStorage.juego3_participant_id` enviado en cada voto para dedup server-side.
- `localStorage.juego3_votes` cachea votos por carta para sobrevivir recarga del navegador.

**Proyector (panel derecho)** — chart de confusión por TIPO de IA:
- Estado `voting`: mensaje "Esperando respuestas" + contador `N / N_vivo` + barra de progreso. **No revela distribución A/B/C** (evita efecto rebaño).
- Estado `revealed`: barras horizontales etiquetadas por TIPO (chatbot / asistente / agente) con icono Phosphor, la barra del agente destacada en verde `#8CBEB2` + badge "Correcta". Las otras dos en violeta tenue. Footer con aciertos/total y pct.
- El objetivo didáctico clave ("distinguir asistente de agente") queda visualmente explícito.

**Backend (`main.py`)** — soporte completo para datos reales:
- `_juego3_build_summary()`: por carta → `por_tipo`, `aciertos`, `pct_acierto` (null si 0 votos), `confusion_dominante`. Global → `aciertos`, `votos`, `pct`, `n_vivo`, `n_sesion`. Extras → `concepto_mejor`, `concepto_peor`, `confusion_top`.
- `GET /api/juego3/summary` — endpoint nuevo para la pantalla final.
- Evento WS `{type: "summary", data: {...}}` emitido en cada reveal (también en `back` a carta anterior).
- **Dedup server-side**: `_juego3_state["votes_by_participant"]` rechaza segundo voto del mismo UUID en la misma carta. Votos duplicados se logean como `duplicate vote ignored`.
- **N_vivo** (participantes WS abiertos ahora) y **N_sesion** (participantes que han votado al menos una carta): métricas separadas, expuestas en `state` y `summary`.
- Logging con **hash SHA256[:8]** del UUID (`_short_pid`) para trazabilidad sin PII.

**Eliana final** — devolución basada en datos del grupo:
- Nuevo prompt `juego3_final` en `_DEFAULT_PROMPTS` + registrado en `ACTIVITY_PROMPTS`.
- El backend inyecta el `SummaryObject` JSON al final del system prompt cuando `activity_mode == "juego3_final"` (sin construcción de prompts en cliente).
- `startJuego3ElianaFinal()` en `app.js`: fetch summary → si `cartas_jugadas=0` usa ramal amable sin LLM; si hay datos abre `/ws/chat` con activity_mode y streamea tokens.
- **Fallback condicional**: si a los 2s no ha llegado ningún token, muestra strip de chips con pct_acierto por carta (`juego3-chip-pct`). Si llegan tokens después, el strip se retira.
- `max_tokens=350`, `temperature=0.75`. Prompt instruye tono jovial, 3-5 frases, no recitar porcentajes crudos ("la mitad", "uno de cada tres").

**Docs**:
- Nueva spec técnica `docs/juego3-spec.md` — contrato de datos completo, eventos WS, criterios de aceptación (DoD).
- **CLAUDE.md NO modificado** (regla del repo respetada). La sección diapo 3 se revirtió al estado pre-v23.11.8 al inicio de este cambio.

## v23.12.0 — 2026-04-24 — Breakpoint >=1920px para TVs/proyectores/monitores grandes
- Nuevo `@media (min-width: 1920px)` en juego3 con escalado completo (fuentes + padding + controles + panel), tras aprobación del reviser.
- Enunciado 22→28px, opciones 20→24px, pregunta 28→36px, círculo A/B/C 34→42px, icono frente 36→44px, panel título 22→26px, barras alto 38→42px.
- Columna izquierda: `clamp(560px, 36vw, 780px)` — máximo 780px para que el panel derecho mantenga 60-80% del ancho.
- Altura natural de opciones (flex: 0 0 auto) preservada — hueco controlado en cartas cortas (1, 2) preferible al recorte en largas (3, 4, 5).

## v23.11.8 — 2026-04-24
- Diapo 3 "Descubre al agente" — rediseño profundo del card-pair tras iteraciones con feedback del usuario:
  - **10 cartas → 5**: seleccionadas las 5 más memorables (ids originales 1, 2, 5, 8, 10) — renumeradas 1-5. `total: 5` en `juego3_cards.json`
  - **Nuevo campo `enunciado_frente`** en cada carta: frase corta con tono juguetón que sustituye al `area` (que era spoiler — describía la característica del agente, que ES la respuesta)
  - **`area` se mueve al dorso** como chip "Concepto: X" con fondo violeta, visible solo tras el reveal
  - **Layout vertical**: frente violeta ARRIBA (full-width), dorso blanco ABAJO (full-width). Antes era horizontal (frente izq / dorso der)
  - **Sin passepartout frosted**: eliminado el marco crema estilo Blinda modal; solo la tarjeta directa. Contenedor con `align-self: stretch` para ocupar toda la altura del área de juego
  - **Columna izquierda unificada** `.juego3-left-col`: tarjeta + botones Revelar/Siguiente juntos; panel de votos (aside) ocupa el resto del ancho
  - **Color único `#6B2F6D` violeta** para las 5 cartas (era un gradiente distinto por formato)
  - **Distribución de respuestas correctas balanceada**: A=2, B=1, C=2 (antes 3 de 5 eran B)
  - **Cursiva eliminada** de opciones en formato casting
  - **Jerarquía tipográfica coherente**: enunciado 22px Dosis bold / opciones 20px Source Sans (gap visual ~2px)
- TTS automático al abrir carta: Eliana lee SOLO `enunciado_frente` (no intro, no pregunta, no opciones). `triggerJuego3CardTTS` ignora `state.ttsEnabled` (el enunciado es narrativa del juego, no TTS conversacional)
- Fix reveal: quitado `transform: scale(1.03)` de `correctPulse` y `scale(1.01)` de `:hover` — la opción correcta ya no "se sale" visualmente al marcarse. Sustituido por bg + border-width: 2px
- Safeguards anti-overflow: `.juego3-opt` con `flex: 0 0 auto` (altura natural, no se recorta), `min-width: 0`, `overflow-wrap: break-word`, `word-break: break-word`, `hyphens: auto` en el texto
- Enunciados sin "Escuchadlas / Escuchad" → "Fijaos / Fijaos cómo" (evitar confusión: las opciones son texto, no audio)
- Backend: caché en memoria `_juego3_cards_cache` eliminada de `_load_juego3_cards` — lee el JSON fresco del disco en cada request para evitar staleness durante desarrollo
- Versionado: sync v23.11.8 en `index.html` y `encuesta.html`

## v23.8.6 — 2026-04-23
- Fix crítico del enrutado STT del widget en diapo 3:
  - `isOnBlindaScreen()` relajado: basta con que `#juego3-screen` esté visible (antes exigía `juego3 + widget` y fallaba si el widget tenía estado transitorio), lo que disparaba `showChatScreen` legacy no-op
  - Log `[BlindaWS]` simplificado (se eliminaron referencias residuales a `demoStep` y `blindaPhase`)

## v23.8.5 — 2026-04-23
- Saneo profundo del chat del widget Eliana (post-audit reviser):
  - `prior_context` legacy eliminado en `sendBlindaMessage` — dejaba de contaminar el LLM con narrativa del juego viejo ("tarjetas", "FASE 1", "ojo crítico")
  - Nuevo prompt `juego3_chat` en `main.py` + registrado en `ACTIVITY_PROMPTS`; widget envía `activity_mode: 'juego3_chat'` (`'blinda'` queda solo para diapo 4 legacy)
  - `_BLINDA_LEGACY_TERMS` ampliado de 5 a 11 términos; chequea ahora ambos prompts ('blinda' y 'juego3_chat')
  - Lógica de fases y auto-advance (`blindaPhase`, `advanceDemoTo`, `checkTerritoryHighlight`) eliminada del chat activo del widget (-34 líneas)

## v23.8.4 — 2026-04-23
- Hotfix del prompt "blinda": reescrito para el juego actual ("Descubre al agente")
  - Conocimiento completo sobre chatbot/asistente/agente y autonomía operativa
  - Descripción de 10 cartas, 10 áreas de aprendizaje y 4 formatos visuales
  - Reglas de conversación (pistas sin revelar respuesta, aclaración asistente↔agente)
  - Tono jocoso/jovial con conectores orales
- Anti-regresión en arranque (`main.py`): chequeo silencioso de términos legacy en prompts clave; `[WARN]` si alguno reaparece en merges futuros

## v23.8.3 — 2026-04-23
- Fixes #1, #2 y #3 del audit del reviser sobre el chat del widget:
  - #1 TTS OFF por defecto al entrar al widget (anula persistencia previa); `voiceTriggered` se resetea tras cada respuesta
  - #2 Sincronización visual del botón MUTE con eventos reales `tts:start`/`tts:end` disparados desde `playTTS`/`stopTTS`/onEnded/onError
  - #3 Pulso de la bocina de burbuja ligado al evento real `tts:end` (no más `setTimeout` 2s)

## v23.8.2 — 2026-04-23
- Cambios en el chat de Eliana al abrirlo:
  - Header reorganizado: orb 3D a la izquierda (44px), "Eliana" arriba + "En línea" debajo (apilado vertical)
  - Botón enviar (✈) variante `--small` (44→34px)
  - Botón "Imagen" eliminado
  - Cada burbuja de Eliana lleva bocina pequeña (`ph-speaker-simple-high`, 26px, semi-transparente) para escuchar TTS individualmente
  - "Escucha a Eliana" renombrado a "Silenciar a Eliana" con icono `ph-speaker-slash`; comportamiento cambia de toggle TTS on/off a MUTE inmediato (corta TTS en curso)
  - TTS automático eliminado del flujo texto: solo suena al pulsar una bocina o si el input vino por micro
  - Mensaje de bienvenida movido a JS para que use el mismo renderizador (con bocina)
- Orb del chat inicializado al abrir el widget (antes solo lo hacía showBlindaScreen legacy)

## v23.8.1 — 2026-04-23
- Cluster de acciones del orb widget (mover/chat/anclar) rediseñado para ser más sutil y combinar mejor con el orb 3D:
  - Tamaño botones: 30 → 24px
  - Fondo botones: lavanda sólido → transparente
  - Contenedor: blanco sólido → blanco translúcido con blur
  - Color iconos: negro → púrpura suave `#8B5A8C`
  - Iconos Phosphor: `ph-bold` → `ph` (trazos más finos)
  - Opacidad 0.85 por defecto → 1.0 en hover del widget (integración visual)
- Orb y posición intactos. Aplica a toda diapositiva que use el widget.

## v23.8.0 — 2026-04-23
- Responsive sweep para escritorio/portátil en diapos 1, 2, 3:
  - Breakpoints homogéneos: 1500px, 1400px, 1280px, 1100px + `max-height: 800px` y `max-height: 720px`
  - Portátiles tipo HP 1366×768 ahora renderizan sin cropping
  - Comprensión progresiva: tamaños de texto, paddings, gaps, orbs y elementos gráficos
  - Fallback móvil (`max-width: 900px`) conservado sin cambios
- Diapo 1: login-name, orb wrapper, workshop-title/subtitle, login-btn, login-footer y gatos decorativos escalan con viewport
- Diapo 2: grid jintro-body, qr-card, cat, title/how/list se reducen coherentemente; breakpoint `max-height: 720px` específico para portátiles cortos
- Diapo 3: layout split (carta/panel) se compacta antes de apilar; card question, options, bars, controles y pantallas idle/ended/eliana se escalan
- Fuera de scope de este sweep: diapos 4-7 (rediseño pendiente)

## v23.7.5 — 2026-04-23
- Saneo legacy Fase 3 (opción A+B):
  - A) Se cancela el borrado masivo de HTML/CSS: las pantallas legacy están
    acopladas a JS activo (30+ referencias a `elements.welcomeScreen`, etc.).
    Borrar el HTML rompe código. Permanecen con `display:none` y guards.
  - B) Bodies de las 7 funciones legacy reducidos al guard
    (`showChatScreen`, `showWelcomeScreen`, `showPlanScreen`,
    `showWelcomeFromPlan`, `showChatFromPlan`, `showConoceScreen`,
    `showBlindaScreen`). −118 líneas de código muerto eliminadas.
- Documentación arquitectónica (tras audit del reviser):
  - Comentario de `MODO_PRESENTACION` actualizado: ahora explica la dualidad
    "toggle real vs marcador de auditoría". En estas 7 funciones `false` ya
    no restaura comportamiento — requiere recuperar body de git.
  - Añadido JSDoc `@deprecated` en cada función reducida con instrucción
    `git show <hash>:static/app.js` para recuperación futura.

## v23.7.4 — 2026-04-23
- Saneo legacy Fase 2 corregido tras audit:
  - Quitado guard de `showJuegoScreen` (protegida por diapo 4 + rompía `?screen=juego`)
  - Añadido guard en `showPlanScreen` (faltaba, se dispara desde click en plan-card)
  - Comentario del kill-switch reescrito (const no se reasigna en runtime)

## v23.7.3 — 2026-04-23
- Fase 2: kill-switch `MODO_PRESENTACION` + 7 guards en funciones legacy (showWelcomeScreen, showWelcomeFromPlan, showChatFromPlan, showChatScreen, showConoceScreen, showBlindaScreen, showPlanScreen). Corte funcional: aunque un listener legacy invoque la función, el guard la hace NO-OP con console.warn `[LEGACY bloqueado]` para trazar.

## v23.7.2 — 2026-04-23
- Fase 1 saneo legacy: pantallas `#welcome-screen`, `#chat-screen`, `#plan-screen`, `#profile-screen` forzadas ocultas con `style="display:none"` inline + `data-legacy="true"` + `aria-hidden="true"`. No pueden reaparecer aunque `.hidden` se pierda.

## v23.7.1 — 2026-04-23
- Cluster de acciones del orb: botones movidos ENCIMA del FAB (`bottom:100%` en vez de `top:100%`) para que no se corten por la parte inferior del viewport
- Tamaño de los 3 botones: 40 → 30px

## v23.7.0 — 2026-04-23
- FAB click handler cambiado: activa voz (micro + TTS) directamente en vez de abrir el chat floating
- Nuevo cluster de 3 botones Phosphor bajo el FAB (visible solo en estado FAB): Mover (arrastrar con drag), Chat (floating), Anclar derecha (docked)
- Drag del widget desde el botón Mover con soporte mouse + touch, clamp al viewport

## v23.6.9 — 2026-04-22
- Orb del widget Eliana más grande: FAB 60 → 110px, orb 44 → 100px (init también a 100 para canvas nítido)

## v23.6.8 — 2026-04-22
- Visualización del FAB del orb corregida: quitado `background: #1a1a2e` (navy oscuro), `box-shadow` y `animation: fabPulse` con glow azul. El orb ahora flota libre como en la diapo 1 del login, sin contenedor oscuro alrededor

## v23.6.7 — 2026-04-22
- Fix diapo 3: el estado del juego se resetea automáticamente al refrescar el navegador (fetch POST a `/api/juego3/reset` al cargar). Navegar entre diapos sin recargar conserva el estado; recargar vuelve a idle

## v23.6.6 — 2026-04-22
- Diapo 2: eliminado el botón "Empezar a jugar" — navegación solo por flecha derecha del header
- Diapo 2: revertido `margin-bottom: -18px` del heading "¿Cómo se juega?" (causaba overlap con el paso 1)

## v23.6.4 — 2026-04-22
- Diapo 2: `margin-bottom: -18px` en `.jintro-main__how` para acercar el título a los pasos (demasiado agresivo, se revierte en v23.6.6)

## v23.6.3 — 2026-04-22
- Diapo 3 "Descubre al agente" (juego3) arrancada:
  - `static/juego3_cards.json` con 10 cartas (áreas, formatos, opciones, correcta varía A/B/C)
  - Backend: estado `_juego3_state`, WS `/ws/juego3` (móvil) y `/ws/juego3-dashboard` (escritorio), endpoints `GET /juego3`, `GET /api/juego3/cards`, `GET /api/juego3/state`, `POST /api/juego3/reset`
  - Página móvil `static/juego3_mobile.html` con votación táctil
  - Escritorio `#juego3-screen` con layout split (carta izq / barras vivas der) + controles ponente (Revelar, Siguiente)
  - 4 formatos visuales: casting, misma-orden, mientras-no-estabas, titular
  - Pantalla final con Eliana + orb comentando resultados (streaming placeholder)
- Widget flotante de Eliana reutilizado del `.eliana-widget` existente del proyecto: movido al top-level, 4 estados (fab/floating/docked/expanded), drag desde cabecera, orb mini integrado
- Antigua diapo 3 `#blinda-screen` marcada como LEGACY oculta (`display:none`, `data-legacy="true"`)
- CLAUDE.md: protección de diapo 3 ahora cubre juego3

## v23.5.1 — 2026-04-22
- Diapo 2 bloqueada en CLAUDE.md (protección de zona)
- Quitado subtítulo "Un juego de 10 cartas" debajo del título

## v23.5.0 — 2026-04-22
- Diapo 2 — contenido y layout rediseñado por completo:
  - Título: "Aprende qué es un agente de IA" (gato al lado)
  - Subsección "¿Cómo se juega?" en violeta profundo
  - 5 pasos reescritos sin inventar situaciones de aula (enfocado en aprender QUÉ es un agente)
  - QR inline SVG en tarjeta blanca grande (220px) a la izquierda, ya no depende del servidor
  - CTA "Empezar a jugar" pequeño centrado al final de la columna derecha
- Sistema de tarjetas del juego diseñado conceptualmente (10 cartas secuenciales, 4 formatos: Casting, Misma orden, Mientras no estabas, Titular)

## v23.4.1 — 2026-04-22
- Flecha de los botones nav → lavanda `#D0AAD1` (coherencia con el CTA "EMPEZAR A JUGAR")
- Hover invierte: círculo lavanda + flecha negra
- Contraste ~8:1 (WCAG AAA)

## v23.4.0 — 2026-04-22
- `.slide-nav-btn`: círculo negro `#2c2c2c` (antes lavanda), sombra exterior más profunda, inset blanco eliminado

## v23.3.9 — 2026-04-22
- Pill del número de diapo `.slide-header__num`: fondo crema `#FFE7C1` + texto negro `#2c2c2c` → contraste ~13:1 (WCAG AAA). Eliminado `backdrop-filter: blur`.

## v23.3.8 — 2026-04-22
- `.slide-header__text` título → negro `#2c2c2c` (antes blanco sobre mostaza, contraste insuficiente)
- Google Fonts URL ampliada: Dosis 800 + Source Sans 3 800/900 para que `font-weight: 900` renderice de verdad (antes caía a 700 por falta de pesos cargados)

## v23.3.7 — 2026-04-22
- `.slide-nav-btn`: flecha violeta `#6B2F6D`, tamaño 20px, Phosphor `ph-bold` en diapo 2
- `.slide-header__title`: `align-items: baseline` → `center` (pill y título en el mismo eje vertical)
- Portada: tagline 22px peso 700, subtítulo 26px peso 600 (más visibles a distancia)

## v23.3.6 — 2026-04-22
- Portada: tagline "enseñanza · lenguas · IA · agentes" 16px → 22px, peso 700
- Portada: subtítulo del taller "Agentes que personalizan..." 18px → 26px, peso 600
- Ambos textos con color `on-surface` (más oscuro que antes) para legibilidad a distancia

## v23.3.5 — 2026-04-22
- Sistema **mono-mostaza**: eliminado mostaza claro `#E8CB4E` globalmente (no tenía contraste suficiente)
- `.slide-header` → color sólido `#C9A632` (sin gradiente)
- "Eliana" en portada → mostaza profundo `#8A6A1C` (familia unificada con el header)
- Todos los textos del header a peso **900** (título, pill "02", subtítulo)
- Sombra del header tintada con mostaza profundo para profundidad

## v23.3.4 — 2026-04-22
- "Eliana" portada probada en púrpura profundo `#6B2F6D` — descartado por falta de coherencia con headers mostaza (revertido en v23.3.5)

## v23.3.3 — 2026-04-22
- **Migración global de color**: eliminados del proyecto completo `#F4C09D` (melocotón) y `#F2AAAE` (rosa)
- Sustituidos por `#E8CB4E` (mostaza claro) y `#C9A632` (mostaza oscuro) respectivamente
- Aplicado en `style.css`, `encuesta.html`, `suena.html`, `paleta-preview.html`, `app.js`
- Tokens `--md-sys-color-secondary/tertiary` actualizados → propaga a chips, hovers, sombras
- `CLAUDE.md` actualizado con nueva paleta oficial

## v23.3.2 — 2026-04-22
- `.slide-header` de todas las diapositivas: gradiente melocotón+rosa → mostaza `#E8CB4E → #C9A632`
- Sombra del header adaptada al nuevo tono

## v23.3.1 — 2026-04-22
- Fix colisión CSS: clases `.juego-intro__*` de la nueva diapo 2 renombradas a `.jintro__*` para no sobrescribir las del juego Blindapalabras (diapo 4)
- Rediseño compacto de diapo 2: grid 2 columnas (ladder+bocadillo izq / cómo se juega+QR der)
- Añadida explicación detallada del juego en 4 pasos numerados
- Chatbot/Asistente/Agente con chips de color coherentes en bocadillo y pasos
- Lead único (eliminada repetición del título en hero — ya está en header)
- `height: 100dvh + overflow: hidden` para encajar sin scroll

## v23.3.0 — 2026-04-22
- **Nueva diapo 2**: "¿Qué es un agente de IA?" (`#juego-intro-screen`)
- Introduce los tres niveles de IA: Chatbot → Asistente → Agente antes del juego
- Flujo: login → juego-intro → blinda (diapo 3)
- Deep link `?screen=juego-intro` soportado
- Antigua "Conoce a Eliana" (`#conoce-screen`) marcada como LEGACY oculta

---

## Paleta oficial (actual)

| Rol | Color | Hex |
|-----|-------|-----|
| Primary (botones) | Lavanda | `#D0AAD1` |
| Header accent | Mostaza oscuro | `#C9A632` |
| Título marca (Eliana) | Mostaza profundo | `#8A6A1C` |
| Surface | Crema | `#FFE7C1` |
| Body bg | Menta suave | `#E8F2F3` |
| Accent | Menta | `#D0E8E9` |
| Success | Verde menta | `#8CBEB2` |
