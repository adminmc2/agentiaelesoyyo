# Changelog — AgentiaELE

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
