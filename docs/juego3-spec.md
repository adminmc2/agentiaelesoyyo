# Spec técnica — Juego 3 "Descubre al agente"

Última actualización: v23.13.0

Este documento es la **fuente de verdad** sobre el contrato de datos, eventos WebSocket, y criterios de aceptación del juego 3. CLAUDE.md se mantiene intocable; los detalles de implementación viven aquí.

## 1. Piezas

| Pieza | Ruta / Selector | Responsabilidad |
|-------|-----------------|-----------------|
| Datos | `static/juego3_cards.json` | 5 cartas (`id`, `area`, `formato`, `enunciado_frente`, `intro`, `pregunta`, `opciones[3]`, `correcta`, `explicaciones`) |
| Móvil jugador | `static/juego3_mobile.html` (servido en `/juego3`) | Votar + feedback personalizado post-reveal |
| Proyector | `#juego3-screen` en `static/index.html` | Presentar carta + panel de resultados + pantalla final Eliana |
| Backend estado | `_juego3_state` en `main.py` | Estado global del juego, dedup server-side |
| Backend endpoints | `/api/juego3/{cards,state,summary,reset}` + `/ws/juego3{,-dashboard}` | APIs y WebSockets |

## 2. Identificación de participante

- El cliente móvil genera un **UUID v4** en primera visita y lo persiste en `localStorage.juego3_participant_id`.
- Se envía con cada mensaje WebSocket (`hello` al conectar + cada `vote`) como campo `participant`.
- Backend registra `{participant_id → {card_idx → letter}}` en `_juego3_state["votes_by_participant"]`.
- Logs muestran **hash corto** (SHA256[:8]) del UUID, nunca el valor crudo.

## 3. Semántica de N (contadores de participantes)

Dos métricas distintas, nunca mezclar:

- **`N_vivo`**: participantes con WebSocket abierto AHORA (dispositivos conectados en este momento). Se usa para el contador "X de N han votado" en el proyector durante voting.
- **`N_sesion`**: participantes únicos que han votado al menos una vez a lo largo de la sesión. Se usa para el summary final de Eliana (denominador de "aciertos totales / votos posibles").

Backend calcula ambos:
- `N_vivo = len({pid for pid in _juego3_mobile_pid.values() if pid})`
- `N_sesion = len(_juego3_state["session_participants"])`

Broadcasting: cada `state` y `tally` lleva `n_vivo`. `summary` lleva ambos (`global.n_vivo` + `global.n_sesion`).

## 4. Eventos WebSocket

### 4.1 Cliente → servidor (`/ws/juego3`)

```json
// Cuando conecta: registrar su UUID
{ "type": "hello", "participant": "<uuid>" }

// Votar: dedup server-side asegura un solo voto por (pid, card)
{ "type": "vote", "card": 0, "letter": "A", "participant": "<uuid>" }
```

### 4.2 Servidor → cliente (broadcast)

```json
// Estado del juego (cada cambio de fase o carta)
{ "type": "state", "current_card": 0, "phase": "voting", "total": 5, "n_vivo": 7, "n_sesion": 7 }

// Votos de la carta actual
{ "type": "tally", "card": 0, "votes": {"A": 3, "B": 1, "C": 2}, "total_votos": 6, "n_vivo": 7 }

// Resumen agregado (emitido en cada reveal + bajo demanda vía GET /api/juego3/summary)
{ "type": "summary", "data": { ...SummaryObject } }
```

### 4.3 Dashboard → servidor (`/ws/juego3-dashboard`)

```json
{ "type": "advance" }  // Avanzar a siguiente carta o empezar
{ "type": "reveal" }    // Revelar respuesta y emitir summary
{ "type": "back" }      // Volver a carta anterior (ya revelada)
{ "type": "reset" }     // Limpiar estado completo (vuelve a idle)
```

## 5. Contrato de datos — SummaryObject

```typescript
type SummaryObject = {
  total_cartas: number;           // 5
  cartas_jugadas: number;         // carts con total_votos > 0
  por_carta: CartaStats[];        // longitud = total_cartas
  global: GlobalStats;
  concepto_mejor: string | null;  // area de la carta con mejor pct_acierto (solo jugadas)
  concepto_peor: string | null;   // area de la carta con peor pct_acierto (solo jugadas)
  pct_mejor: number | null;       // 0-100 o null si no hay jugadas
  pct_peor: number | null;
  confusion_top: "chatbot" | "asistente" | null;  // tipo incorrecto más votado agregado
};

type CartaStats = {
  id: number;                     // 1-5
  area: string;                   // "Actúa por su cuenta", etc.
  pregunta: string;
  correcta_letra: "A" | "B" | "C";
  correcta_tipo: "chatbot" | "asistente" | "agente";  // siempre "agente" en este juego
  por_tipo: { chatbot: number; asistente: number; agente: number };
  aciertos: number;               // = por_tipo[correcta_tipo]
  total_votos: number;            // suma de por_tipo
  pct_acierto: number | null;     // null si total_votos == 0 (¡no es lo mismo que 0%!)
  confusion_dominante: "chatbot" | "asistente" | null;  // tipo incorrecto con más votos
};

type GlobalStats = {
  aciertos: number;
  votos: number;
  pct: number | null;
  n_vivo: number;
  n_sesion: number;
};
```

**Regla crítica**: `pct_acierto = null` distingue "nadie respondió" de "0% acertó". La UI y el prompt deben tratarlos distinto.

## 6. Flujo del juego

```
idle → (advance) → voting(c=0) → (votes incoming) → (reveal) → revealed(c=0)
     → (advance) → voting(c=1) → ... → voting(c=4) → (reveal) → revealed(c=4)
     → (advance) → ended → (Eliana button) → eliana screen with LLM streaming
     → (reset) → idle
```

En cada transición de fase:
- `state` se emite a todos (móvil + dashboard).
- `tally` se emite al entrar en `voting` (init 0) y en cada voto nuevo.
- `summary` se emite al entrar en `revealed` (y al pulsar `back` para re-revelar una carta anterior).

## 7. Dedup de votos

Reglas:
- Un mismo `participant_id` que vota dos veces la misma carta: **segundo voto ignorado** (backend logea `duplicate vote ignored`).
- Recarga del móvil: el UUID persiste en `localStorage`, el voto ya contabilizado sobrevive.
- Voto sin `participant`: backend acepta (legacy) pero **no dedup**. Se logea `participant=anon`.
- Cambio de dispositivo por el mismo humano: se cuenta como dos participantes distintos. Es una limitación aceptada.

## 8. Edge cases garantizados

| Caso | Comportamiento garantizado |
|------|---------------------------|
| 0 votos en una carta | `total_votos=0`, `pct_acierto=null`, UI muestra "Nadie respondió esta vez" |
| 0 cartas jugadas | `cartas_jugadas=0`, `concepto_mejor=null`, Eliana usa rama de fallback amable |
| Recarga del móvil en medio de voto | UUID sobrevive, voto ya registrado se mantiene; si no había votado, vuelve a estado voting |
| Jugador se conecta tras reveal de carta actual | Móvil recibe `state` + `tally` + `summary` al hacer handshake, muestra "No votaste esta vez" |
| Desconexión temporal | `N_vivo` decrementa en tiempo real; al reconectar vuelve a sumarse |
| Votante ausente en el dashboard | N/A — el dashboard no vota, solo presenta |
| LLM lento/falla en pantalla final | UI muestra strip de chips pct por carta como fallback condicional (solo si el texto no llegó o está vacío a los 2s) |

## 9. Feedback al jugador (móvil, fase `revealed`)

Banner visual + mensaje + explicaciones:

| Caso | Color banner | Texto | Explicaciones mostradas |
|------|--------------|-------|-------------------------|
| Acertó | Verde `#8CBEB2` | `✓ ¡Correcto!` | Solo la del `correcta_tipo` |
| Falló | Ámbar `#D4826A` | `✗ Confundiste <tipo_elegido> con agente` | Del `correcta_tipo` + del `tipo_elegido` |
| No votó | Gris neutro | `No votaste esta vez. La correcta era (<letra>) — <tipo>` | Solo la del `correcta_tipo` |

Redundancia triple (color + icono Phosphor + texto) para accesibilidad.

## 10. Eliana final

- Activity mode: `juego3_final`.
- Backend inyecta el `SummaryObject` completo (JSON) al final del system prompt en la sección `DATOS DEL GRUPO`.
- El prompt instruye:
  - 3-5 frases, jovial, con chispa.
  - No recitar porcentajes crudos ("la mitad", "uno de cada tres").
  - Highlights: concepto mejor + peor + confusion_top + pct global.
  - Cierre puente a la siguiente diapositiva.
  - Rama especial si `cartas_jugadas == 0`.
- max_tokens=350, temperature=0.75.
- UI mientras streamea: orb animado + texto en progreso + strip compacto de pct por carta **si el texto no ha llegado a los 2s** (fallback condicional).

## 10-bis. Observabilidad y tests manuales

### Métricas de sesión en cliente (inspeccionables en DevTools)
El objeto `juego3.metrics` lleva contadores simples por sesión:
- `ultimo_recurso_count` — cuántas veces la pantalla final cayó al texto de último recurso.
- `summary_fetch_fail_count` — fallos del `GET /api/juego3/summary`.
- `llm_error_count` — errores en el WS del LLM (`error`, `ws_error`, cierre anómalo).
- `ultimo_recurso_reasons[]` — historial de fallos con timestamp y contexto.

Inspección rápida en consola del proyector durante taller:
```js
juego3DevMetrics()       // imprime tabla
juego3.metrics           // objeto completo
```

### Tests manuales rápidos (sin tirar la red)
Desde la consola del proyector, dev helpers que inyectan fallos controlados:

```js
// Caso A: fetch HTTP falla, WS LLM funciona → debería streamear normal
juego3DevSimulate('summary_fail')
// Pulsar "Ahora Eliana comenta los resultados"
// Esperado: texto streaming llega sin chips locales.

// Caso B: fetch OK, WS LLM falla al abrir
juego3DevSimulate('llm_fail')
// Esperado: chips de fallback aparecen (o mensaje último recurso si no había summary).

// Caso C: ambos fallan
juego3DevSimulate('both_fail')
// Esperado: mensaje "Habéis terminado las cinco cartas…" de último recurso.

// Limpiar simulación
juego3DevSimulate('reset')
```

### Tests manuales con red real
Desde DevTools → pestaña **Network**:
1. `Throttling: Offline` + pulsar "Eliana comenta…" → debe caer al último recurso en ~1-2s.
2. `Throttling: Slow 3G` → debe aguantar el streaming normal (latencia > 2s puede disparar el strip de chips temporalmente; si luego llegan tokens, los chips se retiran).
3. Cerrar el backend (Ctrl+C) → mismo comportamiento que Offline.

Tras cada test, `juego3DevMetrics()` confirma que los contadores se incrementaron donde esperábamos.

## 11. Iconografía por tipo (consistente en móvil + proyector)

| Tipo | Phosphor icon | Color |
|------|---------------|-------|
| chatbot | `ph-chat-circle-text` | violeta tenue `rgba(107,47,109,0.15)` |
| asistente | `ph-note-pencil` | violeta tenue `rgba(107,47,109,0.15)` |
| agente | `ph-lightning` | verde `#8CBEB2` (destacado como correcta) |

## 12. Criterios de aceptación (DoD)

- [ ] Móvil nunca muestra `area`, `intro` ni `format-badge` durante voting.
- [ ] Móvil en reveal:
  - [ ] Acierto muestra 1 explicación (la correcta).
  - [ ] Fallo muestra 2 explicaciones (correcta + elegida) + línea explícita "Confundiste X con Y".
  - [ ] No votó muestra estado neutro, no error.
- [ ] Móvil banner con **triple redundancia**: icono + texto + color.
- [ ] Proyector en voting **no** revela distribución A/B/C (evita efecto rebaño).
- [ ] Proyector en reveal muestra barras por tipo, agente en verde.
- [ ] `total_votos=0` → UI "Nadie respondió esta vez" (no bar en 0%).
- [ ] `pct_acierto=null` distinguido de 0 en código y UI.
- [ ] Dedup server-side: dos votos con mismo pid+card → segundo ignorado, conteo no infla.
- [ ] `N_vivo` y `N_sesion` expuestos y visibles.
- [ ] Eliana final usa `activity_mode: juego3_final`, prompt en backend (no construido en cliente).
- [ ] Strip de chips pct solo aparece como fallback (LLM sin respuesta en 2s o error).
- [ ] Logs backend con `_short_pid()` (hash 8 chars), nunca UUID crudo.
- [ ] Versión bumpeada en `index.html` + `encuesta.html`.
- [ ] CLAUDE.md no modificado.

## 13. Archivos ejecutivos

```
main.py                         # _juego3_build_summary, dedup, hash, logging, prompt juego3_final
static/juego3_cards.json        # 5 cartas (no cambia en esta fase)
static/juego3_mobile.html       # reescritura completa
static/index.html               # panel derecho reescrito
static/style.css                # nuevos estilos chart por tipo + responsive
static/app.js                   # render chart, integración Eliana final, fallback
docs/juego3-spec.md             # este documento
CHANGELOG.md                    # entrada v23.13.0
```
