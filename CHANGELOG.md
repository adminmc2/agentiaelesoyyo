# Changelog — AgentiaELE

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
