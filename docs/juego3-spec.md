# Spec técnica — Juego 3 "Descubre al agente"

Última actualización: v23.14.2 (ver CHANGELOG.md para historial completo)

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

## 10. Eliana final (resumen — detalle en §10-ter)

- Activity mode: `juego3_final`.
- Backend inyecta el `SummaryObject` completo (JSON) al final del system prompt en la sección `DATOS DEL GRUPO`.
- **Estructura del mensaje: semi-blindada en 3 bloques obligatorios** (ver §10-ter):
  - Bloque A — Resumen global (1-2 frases).
  - Bloque B — Repaso de las 5 cartas EN ORDEN, **con agrupación permitida**: cartas consecutivas con resultado parecido van en una sola frase; las perfectas se agrupan salvo que haya matiz pedagógico.
  - Bloque C — Cierre puente a la siguiente diapositiva (1 frase).
- Límites: máximo 8 líneas totales, tono jovial no infantil, sin porcentajes crudos repetidos, sin repetir estructura sintáctica ni verbos.
- Corrección gramatical explícita: "ha habido" (nunca "han habido"); concordancia de género.
- Rama especial si `cartas_jugadas == 0` o `votos == 0`: olvida la estructura, mensaje amable único.
- `max_tokens=360`, `temperature=0.75`.
- UI mientras streamea: texto + panel de resultados detallados (v23.14.0, §10-ter) + strip compacto de pct por carta **si el texto no ha llegado a los 2s** (fallback condicional). Orb central eliminado en v23.15.0 (widget flotante = presencia visual suficiente).

## 10-ter. Pantalla final Eliana: estructura + panel de resultados (v23.14.0)

### Estructura del mensaje de Eliana (prompt `juego3_final`)
Semi-blindada en 3 bloques obligatorios:
- **Bloque A — Resumen global** (1-2 frases): desempeño general.
- **Bloque B — Repaso de las 5 cartas** (variable, hasta 5 líneas): menciona las cartas EN ORDEN. **Agrupación permitida**: cartas consecutivas con resultado parecido comparten una frase; las perfectas se agrupan salvo que haya matiz pedagógico. Las cartas con confusión real merecen mención individual — son el aprendizaje clave. Prohibido repetir misma estructura sintáctica / verbo / plantilla.
- **Bloque C — Cierre** (1 frase): puente a siguiente diapositiva.

Límites: 8 líneas totales, sin porcentajes crudos repetidos, tono jovial no infantil. Lenguaje libre dentro de cada bloque. `max_tokens=360`, `temperature=0.75`.

### Panel de resultados detallados
Layout 2 columnas en `.juego3-eliana` (v23.15.0+): cuerpo (texto streaming) | `.juego3-eliana__results` (tabla). El orb central se eliminó — el widget flotante ya representa a Eliana.

**Contenido del panel** (cuando hay `summary.por_carta`):
- Título "Resultados por pregunta".
- 5 filas: número + concepto (truncado a 1 línea) + barra con pct_acierto + ratio numérico + badge "Confundieron con X" solo si `pct_acierto < 60` y `confusion_dominante` no es null.
- Total: `aciertos/votos` + pct grande verde.

**Revelado progresivo**:
- Contenedor: fade-in + translateY(10px→0) en 500ms, empezando a los 350ms del render.
- Filas: fade-in + translateY con stagger de 80ms entre filas.
- Barras: `scaleX(0→1)` con `cubic-bezier(0.22, 1, 0.36, 1)` 600ms, delay 200ms tras su fila.

**Responsive <1200px**: layout en columna (orb arriba, cuerpo, tabla abajo). Altura natural con scroll.

### Criterios de aceptación (DoD)
- [ ] `cartas_jugadas === 0` o `por_carta` vacío → panel oculto (no placeholders). Solo mensaje amable + CTA.
- [ ] Con summary válido → aparecen exactamente 5 filas, incluso si alguna carta tiene 0 votos (ratio "— / 0", sin barra).
- [ ] Eliana cubre bloques A + B + C en un único mensaje. No excede 8 líneas en la práctica.
- [ ] En <1200px layout sin solapes, scroll vertical si hace falta.
- [ ] Fallback existente de Eliana (chips + último recurso) intacto — el panel de resultados es ortogonal a él.
- [ ] Revelado progresivo visible: fade-in diferido + barras animadas.

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

### Test manual: summary ausente al abrir pantalla final
Caso específico para el **panel de resultados detallados** (v23.14.0): cuando se abre la pantalla Eliana final sin datos disponibles, el panel debe ocultarse y el CTA no debe romperse.

**Pasos**:
1. Con el backend arrancado, abre el proyector directamente en la pantalla Eliana final (sin haber jugado ninguna carta): DevTools → consola →
   ```js
   juego3.phase = 'ended';
   juego3.elianaStreaming = true;
   document.getElementById('juego3-eliana-screen').classList.remove('hidden');
   juego3.summary = null;
   renderJuego3Results();
   ```
2. O bien: pulsa "Reiniciar juego" → EMPEZAR → pulsa directamente "Ahora Eliana comenta los resultados" sin votar nada.

**Resultado esperado**:
- El panel `#juego3-eliana-results` tiene la clase `hidden` (display: none).
- NO aparecen filas ni total.
- Eliana dice el mensaje amable de "no ha habido tiempo de votar, pasemos a lo siguiente" (ramal sin LLM).
- El botón "Avanzar a diapo 4" aparece al terminar el texto y es pulsable.
- No hay errores en consola.

**Resultado si el fetch de summary falla** (otro subcaso):
- `juego3DevSimulate('summary_fail')` → pulsar "Eliana comenta…"
- Panel oculto (al no haber summary cargado).
- Texto streaming del LLM llega si el WS funciona (el backend inyecta summary server-side).

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
CHANGELOG.md                    # historial de cambios por versión
```
