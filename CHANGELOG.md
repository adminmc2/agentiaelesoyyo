# Changelog — AgentiaELE

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
