# Diapo 7 — LucAPI · Comprensión lectora (spec)

Demo interactiva para mostrar a los profes del taller cómo LucAPI acompaña a un estudiante en la comprensión de un texto. Se accede desde la app, en el móvil. Los profes se ponen en el lugar del alumno.

El flujo combina un esqueleto hardcodeado mínimo (preámbulo, OCR de títulos, frase de enganche) con un LLM real guiado por un prompt detallado paso a paso que ejecuta las 10 fases de comprensión adaptadas a nivel A1.

---

## 1. Objetivo de la demo

- Los profes del taller experimentan el proceso de acompañamiento de LucAPI desde el punto de vista del estudiante.
- Cada profe recibe un texto impreso (uno de dos posibles) y sigue la demo en su móvil.
- Solo se muestra la fase de **comprensión lectora** del Analizador. No hay plan de clase, ni vocabulario suelto, ni ejercicios: solo el acompañamiento conversacional.

## 2. Arquitectura general

- **Frontend**: diapositiva nueva en `presentacion agentia ele` (siguiente slot tras diapo 6), con su HTML/CSS/JS alineado al sistema de diseño v23 (paleta pastel, header mostaza sólido).
- **Acceso**: los profes entran desde su móvil a través de la app, igual que con `encuesta.html` o `juego3_mobile.html`.
- **Contenido de los textos**: hardcodeado en un JSON (2 entradas: texto A y texto B).
- **Motor conversacional**: LLM real (mismo proveedor que el resto de la app) guiado por un prompt paso a paso en español. Los enunciados visibles para el estudiante se generan **por defecto en español A1** (es una app ELE, la lengua meta es el español); la lengua que elige el estudiante en el paso 3 se reserva como **apoyo de rescate** (ver escalera de comprensión más abajo).
- **OCR**: real, en el navegador (Text Detection API nativa con fallback a Tesseract.js).

## 3. Flujo completo paso a paso

### Apertura
1. El profe abre la diapo en su móvil dentro de la app.
2. Pantalla inicial de LucAPI con botón **Empezar**.

### Preámbulo fijo (idéntico al Analizador real)
3. LucAPI pregunta: *"¿En qué lengua quieres comunicarte?"*
4. El estudiante elige o escribe su lengua. Esta elección fija el idioma de todos los enunciados de LucAPI a partir de aquí.
5. LucAPI confirma la lengua elegida con una frase breve y cálida.

### Captura del texto con OCR real
6. LucAPI le pide al estudiante que apunte con la cámara al texto que tiene en papel.
7. Se abre el visor de cámara (viewfinder con guías y scan line animada).
8. El estudiante captura un frame.
9. El frame pasa por OCR real:
   - Primero se intenta la **Text Detection API nativa** del navegador.
   - Si no está disponible, fallback a **Tesseract.js** (offline, sin API externa).
10. La salida del OCR (imperfecta) se compara por **distancia de Levenshtein / solapamiento de palabras** contra los dos títulos del JSON.
11. Con solo 2 candidatos, el match acierta aun con OCR mediocre → se decide texto A o texto B.
12. El sistema carga del JSON la entrada correspondiente (título, contenido, temática, nivel, frase de enganche).
13. LucAPI suelta una **frase cálida hardcodeada en español** que introduce la temática sin mostrar el título literal ni pedir confirmación con botones:
    > *"¡Genial! Pues hoy vamos a hablar de [TEMÁTICA]. [Frase de enganche breve, adecuada para A1, atractiva para estudiantes]."*
14. Fallbacks silenciosos:
    - Si el score del match es bajo, LucAPI lo gestiona de forma conversacional (sin botones Sí/No fríos).
    - Si más adelante el estudiante detecta el error ("mi texto no va de eso"), el LLM lo corrige (ver paso 17).

### Análisis (animación)
15. Pantalla breve de "pensando" con el orb animado y fases visibles: *"leyendo…"*, *"preparando tu acompañamiento…"*, etc. Los textos van en español.

### Acompañamiento de comprensión (todo vía LLM con prompt detallado)
16. A partir de aquí **todas las frases de LucAPI las genera un LLM real** guiado por un prompt paso a paso que recorre 10 fases de comprensión. El texto cargado (A o B) se inyecta como contexto. Los enunciados salen **por defecto en español A1** (la lengua meta); las instrucciones del prompt están escritas en español. La lengua pedida en el paso 3 queda reservada como **apoyo de rescate** según la escalera descrita en la sección 4.

Las 8 fases, adaptadas a nivel A1 (estudiante principiante de una lengua extranjera):

- **16.1 Saludo y preparación**
  Saludo corto, bienvenida y explicación muy simple de qué van a hacer.

- **16.2 Predicción desde el título**
  Conecta con la familia del estudiante, activa léxico sobre "familia pequeña" y hace una predicción numérica.

- **16.3 Vocabulario del texto (dos retos)**
  Parte A: chips de palabras que el estudiante ya conoce. Parte B: matching de palabras nuevas con su dibujo/definición. Sin solape de vocabulario entre las dos partes.

- **16.4 Lectura global tranquila**
  Invita a leer el texto entero sin presión. Incluye botón OpenDyslexic (accesibilidad) y modo de lectura guiada frase a frase.

- **16.5 Fichas de personajes**
  Completa 4 mini-fichas (padre, madre, Sara, Luis) con selectores de 3 opciones. Obliga a integrar datos dispersos por el texto.

- **16.6 Chat familiar — ¿quién envía cada mensaje?**
  4 mensajes naturales tipo WhatsApp. El estudiante deduce el remitente por personalidad/rol, no por actividad literal del texto.

- **16.7 Opinión con una palabra**
  Pregunta si le ha gustado, con opciones cerradas (😀 / 😐 / 😕).

- **16.8 Cierre cálido con logros**
  Repaso positivo: palabras aprendidas hoy, felicitación, mini-reto para recordar una palabra nueva. Despedida corta y cercana.

En cada fase el prompt le indica al LLM: qué preguntar, cómo reaccionar a respuestas buenas/regulares/malas, cómo dar andamiaje, cuándo cerrar la fase y pasar a la siguiente, con qué tono hablar.

### Desvíos del estudiante (los gestiona el mismo LLM)
17. Si el estudiante escribe algo fuera de fase (duda, corrección del texto cargado, pregunta cultural, bloqueo, cambio de tema), el LLM actúa según las instrucciones de desvío del prompt: responde, aclara o corrige, y vuelve al carril en la fase donde estaba.

### Final
18. Pantalla de cierre con resumen visual de logros (palabras aprendidas, fases completadas) y botón **Reiniciar** para que otro profe pruebe con su texto.

## 4. Principios transversales del prompt (aplican en todas las fases)

- Frases cortas, una idea por frase.
- Léxico A1; cualquier palabra fuera de A1 se explica al momento.
- Múltiple elección > pregunta abierta.
- Celebrar aciertos, nunca reñir fallos.
- Reformulación por defecto si el estudiante no entiende.
- Ritmo lento, una cosa cada vez.
- **Idioma por defecto: español A1.** Las instrucciones del prompt están en español. Los enunciados al estudiante también.

### Escalera de comprensión ante bloqueo

Cuando el estudiante no entiende una palabra o frase, LucAPI aplica esta escalera **en orden**, subiendo un peldaño solo si el anterior falla:

1. **Reformular en español más simple** — frase más corta, léxico más básico.
2. **Sinónimo o cognado en español** — ofrecer una palabra equivalente fácil.
3. **Ejemplo en contexto en español** — usar la palabra en una frase cotidiana.
4. **Apoyo visual** — emoji, imagen o icono que ilustre la palabra.
5. **Traducción a la lengua pedida en el paso 3** — solo como último recurso, o si el estudiante la pide directamente ("¿cómo se dice en [su lengua]?", "no entiendo, ayúdame en [su lengua]").

El objetivo es que el estudiante permanezca el máximo tiempo posible en español (la lengua meta) y solo "salte" a su L1 cuando de verdad lo necesita.

## 5. Qué es hardcodeado vs qué es dinámico

| Hardcodeado (JSON) | Dinámico (LLM en vivo) |
|--------------------|------------------------|
| Los 2 textos: título, contenido, temática, nivel, frase de enganche | Todas las frases de LucAPI durante las 10 fases |
| Pregunta de lengua (paso 3) | Reacciones a cada respuesta del estudiante |
| Frase de introducción de temática (paso 13) | Andamiaje, reformulaciones, pistas |
| Estructura de 10 fases (dentro del prompt) | Gestión de desvíos y dudas |
| OCR + fuzzy match de títulos | Transiciones entre fases y celebración de logros |

## 6. Estructura prevista del JSON de textos

```json
{
  "textos": [
    {
      "id": "texto_a",
      "titulo": "...",
      "tematica": "...",
      "nivel": "A1",
      "frase_enganche": "...",
      "contenido": "...",
      "palabras_clave": ["..."],
      "palabras_nuevas": [
        { "palabra": "...", "explicacion_simple": "...", "imagen": "..." }
      ],
      "bloques_lectura": ["...", "...", "..."]
    },
    { "id": "texto_b", "...": "..." }
  ]
}
```

(La estructura final se cerrará al escribir el prompt.)

## 7. Próximos pasos

1. Redactar el **prompt del LLM completo** con las 10 fases, instrucciones de desvío y principios transversales.
2. Cerrar la estructura del **JSON** de los 2 textos.
3. Recibir del usuario los **2 textos** reales con sus metadatos.
4. Entregar todo al agente que implementará la diapo.

## 8. Restricciones

- Respetar zonas protegidas de diapos 1–6 (ver `CLAUDE.md`). Todo el trabajo de esta diapo es nuevo.
- Mantener la paleta v23 y el header estándar.
- Cache busting: bumpear `?v=` en `index.html`, `encuesta.html` y `juego3_mobile.html` cuando se implemente.

---

# Anexo A · Texto "Familia pequeña" — Acciones detalladas por fase

## Metadatos del texto

| Campo | Valor |
|-------|-------|
| `id` | `texto_a` |
| `titulo` | Familia pequeña |
| `tematica` | la familia |
| `nivel` | A1 |
| `frase_enganche` | *"¡Genial! Hoy vamos a hablar de la familia. Vas a conocer a Luis, a Sara y a sus padres."* |

## Texto completo

> Mi familia no es muy grande, somos solo cuatro personas: mi padre, mi madre, mi hermana y yo. También tenemos un perro.
>
> Yo soy mayor que mi hermana, pero ella es más alta. Yo tengo doce años y ella once. Mis padres se llaman Javier y María, mi hermana se llama Sara y yo Luis. Vivimos todos juntos en una casa muy bonita.
>
> Mi padre es banquero y mi madre ama de casa. Por la mañana, desayunamos juntos en la cocina. Me gusta desayunar con mi familia. Además, por las mañanas siempre tengo hambre. Después del colegio, mi madre prepara una comida deliciosa. Por la tarde, mi madre queda con sus amigas, y mi padre juega al tenis. Mi hermana y yo hacemos los deberes, y después vemos la televisión. Los viernes por la tarde vamos los cuatro de compras.
>
> Mi padre es alto y rubio, y mi madre es morena y delgada. A mi hermana le gusta quedar con sus amigas en el parque. Yo me divierto mucho más jugando a los videojuegos en casa.

---

## 16.1 · Saludo y preparación

**Enunciado LucAPI** (ejemplo):
> *"¡Hola! Soy LucAPI. Hoy vamos a leer un texto juntos. Va a ser fácil y divertido. ¿Preparado/a?"*

**Respuesta esperada del estudiante**: "sí", emoji 👍, o tap en botón **Empezar**.

**Reacciones**:
- Si responde sí → *"¡Genial! Vamos allá."* → avanza.
- Si tarda >10 s → *"¿Estás ahí? Cuando quieras empezamos."*
- Si responde algo raro → LLM lo gestiona con frase simple y repite la invitación.

**Cierre de fase**: confirmación afirmativa del estudiante.

---

## 16.2 · Predicción desde el título (combinada B3 + B2)

### Paso 1 · Conecta con tu familia

**Enunciado LucAPI**:
> *"Antes de leer, cuéntame un poco de ti. ¿Tu familia es pequeña o grande?"*

**Opciones tappables**:
- 🤏 Pequeña
- 🙌 Grande

**Reacción**:
- Pequeña → *"¡Como la del texto! Vamos a ver."*
- Grande → *"Qué bien. La del texto es pequeña, vamos a ver cuántos son."*

### Paso 2 · ¿Cuántos sois en tu familia?

**Enunciado LucAPI**:
> *"¿Y cuántas personas hay en tu familia? Toca un número."*

**Chips selección única**:
`2` · `3` · `4` · `5` · `6` · `más`

**Reacción** (personaliza según el número):
- 2–3 → *"Muy pequeña, qué bonito."*
- 4–5 → *"Una familia pequeña, como la del texto. ¡Qué casualidad!"*
- 6 o más → *"¡Qué familia más grande! La del texto es mucho más pequeña."*

### Paso 3 · ¿Qué es una familia pequeña?

**Enunciado LucAPI**:
> *"Ahora piensa en el texto. Una «familia pequeña» es… Toca las palabras que crees."*

**Chips multi-selección**:
`pocas personas` ✅ · `muchas personas` · `pocos hermanos` ✅ · `muchos hermanos` · `2 o 3 personas` ✅ · `10 personas` · `solo padres e hijos` ✅ · `abuelos y tíos en casa`

**Reacción**:
- Cada acierto → ✅ verde + *"¡Eso es!"*
- Cada fallo → ❌ amarillo suave + *"En una familia pequeña no suele haber tantos."*
- Si acierta ≥ 3 → *"¡Muy bien! Ya sabes lo que es una familia pequeña."*
- Si acierta < 3 → *"Vale, no pasa nada. Una familia pequeña son pocas personas: los padres y uno o dos hijos, no mucho más."*

### Paso 4 · Adivina cuántos son en el texto

**Enunciado LucAPI**:
> *"Una última cosa antes de leer. ¿Cuántas personas crees que hay en la familia del texto?"*

**Chips selección única**:
`2` · `3` · `4` · `5`

**Reacción**:
- 3 o 4 → *"Muy buena idea. Ahora vamos a leer y ves si has acertado."*
- 2 → *"Podría ser. Vamos a leer y lo comprobamos."*
- 5 → *"Posible, aunque eso ya es un poquito menos pequeña. Vamos a ver."*

**Cierre de fase**: cualquier número elegido. No hay acierto/fallo; la confirmación llega en la fase 16.5 (fichas de personajes).

### Comentario pedagógico

- Pasos 1–2 activan la experiencia del estudiante; el LLM puede referenciarla luego ("como en tu familia…").
- Paso 3 enseña el significado del adjetivo clave del título.
- Paso 4 deja una predicción concreta y verificable para cuando el estudiante se encuentre con "somos solo cuatro personas" en la lectura — momento "ajá".

---

## 16.3 · Vocabulario del texto (dos retos sin solape)

### Parte A · Reto 1 — ¿Cuántas ya conoces? (chips)

**Enunciado LucAPI**:
> *"Te voy a hacer un reto. En este texto hay muchas palabras, pero seguro que conoces un montón. Toca todas las que ya sabes."*

**Chips agrupados visualmente**:
- 👥 Personas: `padre` · `madre` · `hermana` · `amigas`
- 👤 Cómo son: `alto` · `rubio` · `morena` · `delgada`
- 🎯 Actividades: `tenis` · `videojuegos`

**Reacción según cuántas toca**:
- **≥ 6 chips** → *"¡Muy bien! Sabes un montón. Reto superado."*
- **3–5 chips** → *"¡Genial! Ya conoces varias. Las otras las vemos rápido."*
- **0–2 chips** → *"No pasa nada, vamos a verlas juntos."*

**Palabras no tocadas**: LucAPI las explica una a una aplicando la **escalera de comprensión** (sección 4):
1. Reformulación en español más simple.
2. Sinónimo o cognado fácil.
3. Ejemplo en frase corta.
4. Emoji o imagen.
5. Solo si hace falta, traducción a la lengua del paso 3.

**Cierre parte A**: todas las palabras confirmadas o explicadas.

### Transición entre retos

**Enunciado LucAPI**:
> *"Ahora otro reto. Mira estas palabras. A lo mejor también las conoces. ¿Eres capaz de juntar cada una con su dibujo?"*

Tono deliberado: **no se dice "te enseño"**. Se asume que el estudiante puede saberlas, y si no, las descubre resolviendo el reto.

### Parte B · Reto 2 — Junta palabra con su dibujo (matching)

**Actividad**: 5 palabras a la izquierda, 5 dibujos + frase a la derecha. El estudiante arrastra o toca-toca para emparejar.

| Palabra | ↔ | Significado |
|---------|---|-------------|
| `banquero` | ↔ | 💰 trabaja en un banco |
| `ama de casa` | ↔ | 🏠 cuida la casa |
| `deberes` | ↔ | 📚 trabajo del colegio |
| `de compras` | ↔ | 🛒 ir a comprar cosas |
| `desayunar` | ↔ | 🥐 comer por la mañana |

**Reacción por cada intento**:
- Acierta → ✅ verde + *"¡Eso es!"* / *"¡Bien!"* / *"¡Qué rápido!"* (variar).
- Falla → la palabra vuelve a su sitio + *"Casi. Mira el dibujo otra vez."*
- Se atasca en una → LucAPI da pista con escalera de comprensión (frase ejemplo → emoji extra → L1 si hace falta).

**Reacción al completar**:
- 5/5 a la primera → *"¡Las has juntado todas a la primera! Eres un crack."*
- 5/5 con algún fallo → *"¡Ya están todas! Muy bien."*

**Cierre parte B**: las 5 palabras emparejadas correctamente.

### Cierre de fase 16.3

**Enunciado LucAPI**:
> *"¡Perfecto! Ya conoces muchas palabras del texto. Ahora va a ser más fácil leer."*

**Transición visual**: avanza a fase 16.4 (lectura global tranquila).

### Notas para el prompt del LLM

- Tono de **reto amistoso**, no de examen. Celebrar aciertos, quitar hierro a fallos.
- **Parte B no se introduce como enseñanza** ("te enseño X"). Se introduce como otro reto con palabras que el estudiante podría saber.
- Si el estudiante falla muchos matches seguidos en la parte B, LucAPI baja el listón: ofrece 3 opciones en vez de 5, o va de una en una.
- Variar las frases de celebración (no repetir siempre *"¡Muy bien!"*).

### Vocabulario específico trabajado en esta fase (sin solape)

| Parte A (chips, reconocimiento) | Parte B (matching, descubrimiento) |
|---------------------------------|------------------------------------|
| padre, madre, hermana, amigas, alto, rubio, morena, delgada, tenis, videojuegos | banquero, ama de casa, deberes, de compras, desayunar |

---

> **Nota**: algunas fases siguientes siguen marcadas como **PROVISIONAL** hasta revisarlas una a una.

---

## 16.4 · Lectura global tranquila

**Enunciado LucAPI**:
> *"Ahora lee todo el texto despacio. No pasa nada si no entiendes todo. Solo mira cómo suena."*

**Acción visual**: se muestra el texto completo de "Familia pequeña" en card grande, tipografía amplia, sin preguntas ni distracciones. Botón **"Ya está"** al final.

### Barra de herramientas de accesibilidad (arriba del texto)

| Botón | Función |
|-------|---------|
| 🔠 **OpenDyslexic** | Toggle de fuente OpenDyslexic para estudiantes con dislexia. Al pulsar, cambia la tipografía del texto. Al pulsar de nuevo, vuelve a la fuente estándar. |
| 👆 **Lectura guiada** | Activa el modo frase-a-frase (ver abajo). Al pulsar de nuevo, desactiva y vuelve a la lectura libre. |

### Estrategia de lectura guiada (frase a frase)

Cuando el estudiante activa "Lectura guiada":

- El texto se divide por **oraciones** (separador: `. `, `? `, `! `). Cada oración se envuelve en un `<span>` con clase propia.
- Solo la **oración actual** se muestra en negro/color pleno.
- El resto del texto queda **atenuado** (gris claro, opacidad baja).
- Un botón **"Siguiente ▶"** (o flecha) avanza a la siguiente oración.
- Un botón **"◀ Anterior"** permite retroceder si el estudiante se perdió.
- Al llegar a la última oración, el botón "Siguiente" se convierte en **"Ya está"** para cerrar la fase.

**Implementación técnica** (nota para quien la programe): trivial con `texto.split(/(?<=[.!?])\s+/)`, un índice de oración actual y dos clases CSS (`.oracion-activa` / `.oracion-atenuada`). No depende del tamaño de pantalla ni requiere detección de líneas visuales.

### Reacciones

- Si tarda < 20 s en lectura libre → *"¿Lo has leído todo? Puedes leer otra vez si quieres."*
- Si pregunta una palabra (desvío) → el LLM responde brevemente aplicando escalera de comprensión y le invita a volver a leer.
- Si tarda > 90 s sin tocar nada → *"¿Vamos siguiendo cuando quieras?"*
- Si activa OpenDyslexic → (sin comentario de LucAPI, es un toggle silencioso).
- Si activa Lectura guiada → breve mensaje la primera vez: *"Muy bien, vamos frase a frase. Cuando entiendas una, toca «Siguiente»."*

### Cierre de fase

Tap en **"Ya está"** (tanto en lectura libre como al final de la lectura guiada).

---

## 16.5 · Ficha de cada personaje (integración de datos dispersos)

**Por qué es comprensión real**: los datos de cada persona están repartidos por distintos párrafos del texto (nombre en uno, profesión en otro, aspecto físico en otro). El estudiante tiene que **integrar información dispersa** para completar cada ficha — no vale con buscar una palabra suelta.

**Enunciado LucAPI**:
> *"Ahora vamos a conocer mejor a cada persona de la familia. Completa las fichas con lo que recuerdas del texto."*

### Estructura de la actividad

Cuatro mini-fichas, una por personaje, presentadas una a una (o las cuatro en scroll vertical). Cada ficha tiene 2–3 huecos y cada hueco es un **selector con 3 opciones** (una correcta).

### Ficha 1 · Padre

| Campo | Opciones |
|-------|----------|
| Nombre | `Javier` ✅ · `Luis` · `Jaime` |
| Profesión | `ama de casa` · `banquero` ✅ · `profesor` |
| Cómo es | `moreno y delgado` · `alto y rubio` ✅ · `bajo y pelirrojo` |

### Ficha 2 · Madre

| Campo | Opciones |
|-------|----------|
| Nombre | `Sara` · `María` ✅ · `Lucía` |
| Profesión | `ama de casa` ✅ · `profesora` · `doctora` |
| Cómo es | `alta y rubia` · `morena y delgada` ✅ · `morena y alta` |

### Ficha 3 · Sara (hermana)

| Campo | Opciones |
|-------|----------|
| Edad | `12` · `11` ✅ · `10` |
| ¿Más alta o más baja que Luis? | `más baja` · `más alta` ✅ |

### Ficha 4 · Luis (narrador)

| Campo | Opciones |
|-------|----------|
| Edad | `12` ✅ · `11` · `10` |
| ¿Mayor o pequeño que Sara? | `mayor` ✅ · `pequeño` |

### Reacciones

- **Cada acierto** → ✅ verde + microcelebración variable (*"¡Bien!"*, *"¡Eso es!"*, *"Exacto"*).
- **Cada fallo** → ❌ suave + pista localizada que apunta al párrafo o frase del texto:
  - Nombre del padre → *"Mira: «Mis padres se llaman Javier y María»."*
  - Profesión del padre → *"El texto dice qué hace el padre. Lee el segundo párrafo."*
  - Aspecto del padre → *"Mira el último párrafo: «Mi padre es alto y rubio»."*
  - Nombre de la madre → *"Misma frase que el padre: «Javier y María»."*
  - Profesión de la madre → *"«Mi madre [es]…»."*
  - Aspecto de la madre → *"Al final del texto: «mi madre es morena y delgada»."*
  - Edad de Sara → *"«Yo tengo doce años y ella once». ¿Cuántos tiene «ella»?"*
  - Altura de Sara → *"«ella es más alta»."*
  - Edad de Luis → *"«Yo tengo doce años»."*
  - Relación de Luis con Sara → *"«Yo soy mayor que mi hermana»."*

- **Si se atasca en un campo** (2 fallos seguidos) → LucAPI ofrece reducir a **2 opciones** (elimina la opción más alejada) y vuelve a preguntar.
- **Si completa una ficha entera a la primera** → *"¡Ficha perfecta! Pasamos a la siguiente."*
- **Si completa las cuatro a la primera** → *"¡Todas las fichas perfectas! Conoces muy bien a la familia."*

### Cierre de fase

**Enunciado LucAPI**:
> *"¡Muy bien! Ya sabes quién es quién en la familia. Vamos a seguir."*

**Cierre de fase**: las 4 fichas completadas (con todos los huecos acertados).

### Notas para el prompt del LLM

- El LLM puede **personalizar las celebraciones** recordando datos ya trabajados (*"¡Exacto! La madre es ama de casa, ya lo habíamos visto"*).
- Si el estudiante pregunta fuera de fase (*"¿y los abuelos?"*), el LLM responde breve (*"Los abuelos no aparecen en el texto, solo los cuatro de la familia"*) y vuelve a la ficha actual.
- Variar las frases de celebración para no sonar repetitivo.

---

## 16.6 · Chat familiar — ¿Quién envía cada mensaje? (comprensión por inferencia)

Sustituye la V/F por frases. La actividad es un chat tipo WhatsApp en el que el estudiante tiene que **deducir el remitente** usando personalidad, rol o costumbres descritos en el texto — **no repite actividades literales**.

### Consigna LucAPI

> *"Imagina el chat de la familia. ¿Quién envía cada mensaje? Toca la cara correcta."*

### Los 4 mensajes (presente, A1, naturales)

| # | Mensaje | Remitente | Pista del texto (deducción) |
|---|---------|-----------|-------------------------------|
| 1 | *"Voy al banco."* 💼 | 👨 Javier | El padre es banquero → trabaja en un banco |
| 2 | *"¿Quién quiere comer?"* 🍽️ | 👩 María | La madre es quien prepara la comida |
| 3 | *"Llego tarde."* ⏰ | 👧 Sara | Sara sale de casa con sus amigas al parque |
| 4 | *"No quiero salir, me quedo en casa."* 🏠 | 👦 Luis | Luis prefiere quedarse en casa con sus videojuegos |

### Opciones de avatar (fijas en cada pregunta)

👨 Javier · 👩 María · 👧 Sara · 👦 Luis

### Reacciones

- **Acierto** → burbuja a verde + ✅ + microcelebración variable (*"¡Eso es!"*, *"¡Muy bien!"*, *"¡Bravo!"*).
- **Fallo** → burbuja vibra + pista inferencial (no literal):
  - *Voy al banco* → *"¿En qué trabaja el padre?"*
  - *¿Quién quiere comer?* → *"¿Quién cocina en la familia?"*
  - *Llego tarde* → *"¿Quién sale de casa en el texto, Sara o Luis?"*
  - *No quiero salir* → *"¿A quién le gusta estar en casa y no salir?"*
- **Se atasca (2 fallos seguidos)** → LucAPI reduce a **2 avatares** (quita los menos probables) y vuelve a preguntar.

### Cierre de fase

**Enunciado LucAPI**:
> *"Muy bien, has entendido muy bien a esta familia. Seguimos."*

**Cierre**: los 4 mensajes identificados correctamente.

### Notas para el prompt del LLM

- **Crítico**: la pista ante fallo nunca debe decir la actividad literal. Siempre pregunta por rol o personalidad (*"¿quién cocina?"*, *"¿a quién le gusta salir?"*), nunca *"¿quién juega al tenis?"* o *"¿quién hace la comida?"* directo.
- Puede variar ligeramente el orden de los mensajes para que profes que comparen no vean la misma secuencia.
- Variar las celebraciones (no repetir siempre *"¡Muy bien!"*).
- Si el estudiante escribe en lugar de tocar avatar (p. ej. *"creo que Javier"*), el LLM lo acepta y procesa.

---

## 16.7 · Opinión con una palabra · PROVISIONAL

**Enunciado LucAPI**:
> *"¿Te ha gustado el texto?"*

**Opciones tappables**:
- 😀 Mucho
- 😐 Normal
- 😕 Poco

**Reacciones**:
- 😀 → *"¡Qué bien! A mí también me gustan las historias de familia."*
- 😐 → *"Vale, está bien. Gracias por contestar."*
- 😕 → *"Gracias por decírmelo. La próxima vez probamos otro tema."*
- Si añade una razón libre → el LLM la celebra y la reformula (*"Ah, te gusta porque hay un perro. ¡Qué chulo!"*).

**Cierre de fase**: cualquier respuesta.

---

## 16.8 · Tus momentos del día (resumen personalizado por el LLM)

El cierre **no** es una lista de palabras aprendidas. Es un resumen basado en la **experiencia real del estudiante** durante la sesión. El LLM ha rastreado todo lo que el estudiante ha dicho y hecho a lo largo de las 8 fases y destaca **tres momentos concretos** de su recorrido, presentados como tarjetas tipo "highlights".

### Estructura visual

Tres cards en columna (o carrusel en móvil), cada una con un icono, un título y una frase personalizada generada por el LLM.

| Card | Icono | Título | Contenido |
|------|-------|--------|-----------|
| 1 · Tu primer momento | 🏠 | *"Al principio"* | Algo que el estudiante dijo/hizo en las fases 16.1–16.3 (su familia, su predicción, sus palabras conocidas). |
| 2 · Tu mejor jugada | 💡 | *"Lo que más me ha gustado"* | Un logro concreto de las fases 16.4–16.6 (una deducción buena, una ficha perfecta, un chat acertado). |
| 3 · Tu cierre | 😊 | *"Y al final"* | La opinión del estudiante (16.7) o un detalle de cómo cerró la sesión. |

### Ejemplos concretos (según lo que el estudiante hiciera)

**Si el estudiante dijo que su familia es pequeña de 4 personas, y acertó el chat a la primera**:

- 🏠 *"Al principio me has dicho que tu familia tiene 4 personas, igual que la de Luis. ¡Qué casualidad!"*
- 💡 *"Has descubierto que el padre va al banco porque es banquero. Muy buena deducción."*
- 😊 *"Y al final me has dicho que te ha gustado mucho el texto. ¡A mí también!"*

**Si el estudiante dijo que su familia es grande, y tuvo que reintentar alguna ficha**:

- 🏠 *"Al principio me has dicho que tu familia es grande — la de Luis es pequeñita, 4 personas."*
- 💡 *"Las fichas de los personajes te han costado un poco, pero las has terminado todas. ¡Bien hecho!"*
- 😊 *"Y has decidido que el texto está «normal». Está bien, no todos los textos tienen que gustarnos mucho."*

### Cómo lo genera el LLM

El prompt de 16.8 instruye al LLM:

1. **Revisar el historial del estudiante** (todas sus respuestas desde 16.1).
2. **Elegir un momento para cada card**:
   - Card 1: primer dato personal significativo (tamaño de familia, palabra que conocía, predicción).
   - Card 2: logro de comprensión más destacado (fila completada a la primera, deducción acertada, chat resuelto).
   - Card 3: opinión final (16.7) o cierre afectivo.
3. **Redactar en español A1** — frase corta, cercana, en segunda persona.
4. **Referir al texto con detalle concreto** (nombre de personaje, dato numérico, actividad).
5. **No repetir la misma estructura verbal** en las tres cards.

### Después de las tres cards

**Frase de cierre LucAPI** (genérica, siempre igual):
> *"Gracias por leer conmigo hoy. Hasta pronto."*

**Botón visible**: **Reiniciar** (para que otro profe pruebe con su texto).

### Cierre de fase

Las tres cards se muestran + la frase de despedida + botón reiniciar. Fin de la demo.

### Notas para el prompt del LLM

- Si el estudiante ha respondido muy poco durante la sesión, el LLM **adapta** las cards a lo poco que tenga (no inventa cosas que el estudiante no dijo).
- Si el estudiante ha respondido mucho, el LLM **elige** los 3 momentos más característicos, no los resume todos.
- Tono: **profe que se despide con cariño**, no informe de evaluación.
- Evitar lista de palabras nuevas como si fuera un examen.
- Siempre referir a la familia del texto por su nombre (Luis, Sara, Javier, María) cuando aplique.

---

## Tabla resumen del JSON previsto para "Familia pequeña"

| Campo | Valor |
|-------|-------|
| `titulo` | Familia pequeña |
| `tematica` | la familia |
| `nivel` | A1 |
| `frase_enganche` | *"¡Genial! Hoy vamos a hablar de la familia. Vas a conocer a Luis, a Sara y a sus padres."* |
| `palabras_conocidas` (16.3·A) | padre, madre, hermana, amigas, alto, rubio, morena, delgada, tenis, videojuegos |
| `palabras_matching` (16.3·B) | banquero, ama de casa, deberes, de compras, desayunar |
| `fichas_personajes` (16.5) | padre, madre, Sara, Luis (con nombre, profesión/edad, aspecto) |
| `chat_mensajes` (16.6) | 4 mensajes con remitente y pista inferencial |

---

# Anexo B · Texto "Mi día" — Acciones detalladas por fase

## Metadatos del texto

| Campo | Valor |
|-------|-------|
| `id` | `texto_b` |
| `titulo` | Mi día |
| `tematica` | la rutina diaria / el día a día de una estudiante |
| `nivel` | A1 |
| `frase_enganche` | *"¡Genial! Hoy vamos a conocer el día a día de una chica que se llama María. Estudia, queda con amigas, viaja los fines de semana… ¡seguro que te parece interesante!"* |

## Texto completo

> Me llamo María Pérez, tengo diecinueve años. Nací en Málaga, pero vivo en Granada. Soy estudiante de primer curso de Periodismo.
>
> De lunes a viernes me levanto a las siete y media, desayuno y camino hasta la universidad. Entro en clase a las nueve y salgo a la una.
>
> Al medio día como la comida en mi casa y veo la televisión. Por la tarde, estudio hasta las siete y después quedo con mis amigas.
>
> A nosotras nos gusta mucho el cine, el teatro y la música. Los viernes por la noche cenamos pizza y bailamos en la discoteca.
>
> Todos los sábados visito a mi familia en Málaga.
>
> El domingo por la tarde regreso a Granada y, si hace sol, salgo con mi perro a dar un paseo. ¡Me encantan los animales!

---

## 16.1 · Saludo y preparación

Patrón fijo idéntico al texto A (genérico para cualquier texto).

---

## 16.2 · Predicción desde el título (4 pasos, adaptada a "Mi día")

### Paso 1 · Conecta con tu día

**Enunciado LucAPI**:
> *"Antes de leer, cuéntame un poco de ti. ¿Tu día normal es…?"*

**Opciones tappables**:
- ⚡ Ocupado
- 🌿 Tranquilo

**Reacción**:
- Ocupado → *"¡Como el de María! Tiene mucho que hacer."*
- Tranquilo → *"Qué bien. El de María es bastante movido, vas a ver."*

### Paso 2 · ¿A qué hora te levantas?

**Enunciado LucAPI**:
> *"¿A qué hora te levantas por la mañana? Toca una hora."*

**Chips selección única**:
`6:00` · `7:00` · `7:30` · `8:00` · `9:00` · `más tarde`

**Reacción**:
- 7:30 → *"¡Igual que María! Vas a ver."*
- Antes de 7 → *"Muy pronto. María se levanta a las 7:30."*
- Después de 8 → *"María es más madrugadora, a las 7:30."*

### Paso 3 · ¿Qué hay en un día normal?

**Enunciado LucAPI**:
> *"Un «día normal» es… Toca lo que piensas."*

**Chips multi-selección**:
`estudiar o trabajar` ✅ · `dormir todo el día` · `comer` ✅ · `estar con amigos` ✅ · `hacer cosas` ✅ · `no hacer nada` · `salir un rato` ✅ · `viajar lejos siempre`

**Reacción**:
- Aciertos → ✅ verde + *"¡Eso es!"*
- Fallos → ❌ amarillo suave + *"En un día normal no solemos hacer eso."*

### Paso 4 · ¿Qué hace María en su día?

**Enunciado LucAPI**:
> *"Una última cosa antes de leer. ¿Qué crees que hace María? Toca lo que piensas."*

**Chips multi-selección**:
`estudia` ✅ · `juega al tenis` · `va al cine con amigas` ✅ · `trabaja en una oficina` · `ve la tele` ✅ · `baila los viernes` ✅ · `pasea a su perro` ✅ · `cocina para mucha gente`

**Reacción**: sin acierto/fallo duro; *"Vale, vamos a leer y vas a ver si has acertado."*

---

## 16.3 · Vocabulario del texto (dos retos sin solape)

### Parte A · Reto 1 — Palabras que ya conoces (chips)

**Enunciado LucAPI**:
> *"Te voy a hacer un reto. En este texto hay muchas palabras, pero seguro que conoces un montón. Toca todas las que ya sabes."*

**Chips agrupados**:
- ⏰ Tiempo: `lunes` · `viernes` · `sábado` · `domingo`
- 🏠 Lugares: `casa` · `universidad` · `Málaga`
- 🎯 Cosas conocidas: `pizza` · `música` · `cine`

Umbrales de reacción idénticos al texto A (≥6 chips reto superado, 3–5 bien, 0–2 se ven juntos). Palabras no tocadas se explican con escalera de comprensión.

### Transición entre retos
Enunciado idéntico al texto A: *"Ahora otro reto. Mira estas palabras. A lo mejor también las conoces…"*

### Parte B · Reto 2 — Junta palabra con su dibujo (matching)

| Palabra | ↔ | Significado |
|---------|---|-------------|
| `periodismo` | ↔ | 📰 estudios para hacer noticias |
| `levantarse` | ↔ | 🛏️ salir de la cama |
| `discoteca` | ↔ | 💃 lugar para bailar |
| `pasear` | ↔ | 🚶 andar por diversión |
| `regresar` | ↔ | ↩️ volver a un sitio |

Mismo patrón de reacciones y pistas que el texto A.

### Cierre de fase 16.3
> *"¡Perfecto! Ya conoces muchas palabras del texto. Ahora va a ser más fácil leer."*

---

## 16.4 · Lectura global tranquila

Misma estructura que el texto A (OpenDyslexic + lectura guiada frase a frase). Solo cambia el contenido del texto mostrado (el de María Pérez).

---

## 16.5 · Fichas del día de María (integración de datos dispersos)

Como "Mi día" tiene una sola narradora, las 4 fichas de personajes del texto A se convierten en **3 fichas del perfil de María**, organizadas por áreas de su vida. Cada hueco es un selector con 3 opciones.

### Ficha 1 · Quién es María

| Campo | Opciones |
|-------|----------|
| Nombre completo | `Ana Pérez` · `María Pérez` ✅ · `María López` |
| Edad | `18` · `19` ✅ · `20` |
| ¿Dónde nació? | `Granada` · `Málaga` ✅ · `Madrid` |
| ¿Dónde vive? | `Málaga` · `Granada` ✅ · `Madrid` |
| ¿Qué estudia? | `Medicina` · `Historia` · `Periodismo` ✅ |

### Ficha 2 · Un día normal (lunes a viernes)

| Campo | Opciones |
|-------|----------|
| ¿A qué hora se levanta? | `7:00` · `7:30` ✅ · `8:00` |
| ¿A qué hora empieza clase? | `8:00` · `9:00` ✅ · `10:00` |
| ¿Dónde come al mediodía? | `en la universidad` · `en un restaurante` · `en casa` ✅ |
| ¿Hasta qué hora estudia por la tarde? | `las 6` · `las 7` ✅ · `las 8` |

### Ficha 3 · Fin de semana

| Campo | Opciones |
|-------|----------|
| ¿Qué cena los viernes por la noche? | `pasta` · `pizza` ✅ · `ensalada` |
| ¿A dónde va los sábados? | `a Madrid` · `a Málaga` ✅ · `a Sevilla` |
| ¿A quién visita los sábados? | `a sus amigas` · `a su familia` ✅ · `a su profesora` |
| ¿Qué hace los domingos si hace sol? | `duerme en casa` · `estudia` · `pasea con su perro` ✅ |

Reacciones y fallbacks idénticos al texto A (pista localizada por hueco, reducción a 2 opciones tras 2 fallos).

---

## 16.6 · Chat — ¿Cuándo lo escribe María? (comprensión por inferencia temporal)

Adaptación del chat a un texto con una sola narradora: en lugar de "¿quién envía?", el estudiante deduce **qué momento** del texto corresponde a cada mensaje. Los mensajes reflejan el **estado de ánimo o la energía** de María en ese momento, **sin copiar literalmente** las actividades del texto.

### Consigna LucAPI

> *"Estos son mensajes que María escribe durante la semana. ¿Cuándo crees que los escribe cada uno? Toca el momento."*

### Los 4 mensajes (presente, A1, naturales, sin frases literales del texto)

| # | Mensaje | Momento correcto | Pista inferencial |
|---|---------|------------------|-------------------|
| 1 | *"Tengo sueño todavía."* 😴 | Mañana L–V | Acaba de levantarse temprano para ir a clase |
| 2 | *"¡Qué ganas de salir!"* ✨ | Viernes noche | Final de la semana, toca fiesta con amigas |
| 3 | *"Qué bien estar en casa."* 🏡 | Sábado | Está con su familia en Málaga |
| 4 | *"Necesito aire libre."* 🌳 | Domingo tarde | Ha vuelto a Granada, le apetece pasear |

### Opciones (fijas en cada pregunta, 4 momentos)

`Mañana L–V` · `Viernes noche` · `Sábado` · `Domingo tarde`

### Reacciones

- **Acierto** → burbuja a verde + ✅ + microcelebración variable (*"¡Eso es!"*, *"¡Exacto!"*, *"¡Muy bien!"*).
- **Fallo** → burbuja vibra + pista inferencial (no literal):
  - *Tengo sueño* → *"¿Cuándo se levanta temprano María?"*
  - *Ganas de salir* → *"¿Qué día sale con sus amigas a bailar?"*
  - *Qué bien en casa* → *"¿Cuándo está con su familia?"*
  - *Aire libre* → *"¿Qué día pasea María?"*
- **Se atasca (2 fallos seguidos)** → LucAPI reduce a **2 momentos** (quita los menos probables) y vuelve a preguntar.

### Cierre de fase

**Enunciado LucAPI**:
> *"¡Genial! Ya sabes cuándo hace cada cosa María."*

**Cierre**: los 4 mensajes asociados a su momento correcto.

### Notas para el prompt del LLM

- **Crítico**: los mensajes nunca copian frases del texto. Son inferencias de estado de ánimo/energía relacionadas con lo que María hace en cada momento.
- Las pistas ante fallo tampoco deben citar la actividad literal del texto. Siempre preguntan por momento/rutina.
- Variar celebraciones.
- Si el estudiante escribe texto libre en vez de tocar opción, el LLM lo interpreta.

---

## 16.7 · Opinión con una palabra

Idéntica al texto A: 😀 Mucho / 😐 Normal / 😕 Poco, con reacciones personalizadas.

---

## 16.8 · Tus momentos del día (resumen personalizado por el LLM)

Misma estructura de 3 cards que el texto A. El LLM adapta los momentos al recorrido del estudiante en este texto.

**Ejemplo** (estudiante que se levanta a las 7:30 igual que María y acierta el chat a la primera):

- 🏠 *"Al principio me has dicho que tu día es ocupado — como el de María. ¡Y te levantas a las 7:30, igual que ella!"*
- 💡 *"Has adivinado rápido cuándo es el mensaje de la pizza. ¡Buena deducción!"*
- 😊 *"Y al final me has dicho que te ha gustado mucho el texto. A mí también: María es muy activa."*

---

## Tabla resumen del JSON previsto para "Mi día"

| Campo | Valor |
|-------|-------|
| `titulo` | Mi día |
| `tematica` | la rutina diaria |
| `nivel` | A1 |
| `frase_enganche` | *"¡Genial! Hoy vamos a conocer el día a día de una chica que se llama María…"* |
| `palabras_conocidas` (16.3·A) | lunes, viernes, sábado, domingo, casa, universidad, Málaga, pizza, música, cine |
| `palabras_matching` (16.3·B) | periodismo, levantarse, discoteca, pasear, regresar |
| `fichas` (16.5) | 3 fichas (quién es María, día normal, fin de semana) |
| `chat_mensajes` (16.6) | 4 mensajes de estado de ánimo + 4 momentos (L-V mañana · V noche · sábado · domingo tarde) |