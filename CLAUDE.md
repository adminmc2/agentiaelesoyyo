# Instrucciones para Claude Code

## Zonas protegidas — NO MODIFICAR sin orden explícita

### Diapositiva 3 (Blinda tu Prompt — Demo en plenaria)
**PROHIBIDO** modificar cualquier código relacionado con la diapositiva 3 a menos que el usuario diga explícitamente que hay que modificar algo de la diapo 3.

Esto incluye:
- `showBlindaScreen()` y todo el flujo de demo (pasos 0-4, auto-advance, territory highlight)
- `sendBlindaMessage()` — detección de fase (`blindaPhase`), envío por WebSocket, `handleBlindaMessage`
- `advanceDemoTo()` — transiciones visuales entre pasos de la demo
- `checkTerritoryHighlight()` — resaltado de tarjetas de territorio durante streaming
- `TERRITORY_KEYWORD_MAP` — mapeo de palabras clave a territorios
- `fetchBlindaCards()` — carga de tarjetas desde BD/JSON
- Prompt "blinda" en `main.py` (ACTIVITY_PROMPTS["blinda"]) — fases 1-3, glosario, instrucciones
- Todo el HTML/CSS de `#blinda-screen`, `.blinda-demo__*`, `.blinda-chat__*`
- La lógica de `prior_context` para blinda en el WebSocket handler de `main.py`

Si el usuario pide un cambio general (refactor, limpieza, mejora) que podría afectar la diapo 3, **preguntar antes** de tocar cualquier cosa de esta zona.
