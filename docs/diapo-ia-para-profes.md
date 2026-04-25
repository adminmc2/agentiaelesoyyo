# Diapo · IA para profes

Contenido listo para implementar. Voz de producto, no enciclopedia. Eje visual: el texto y sus preguntas siempre en pantalla; los 5 agentes como satélites.

---

## Título

**IA para profes**

## Subtítulo

**Tú los creas. Tú los aplicas. Eliana los dirige.**

---

## Intro

"IA para profes" no es usar agentes ya hechos. Es **crear los tuyos**, para **tus materiales**, y dejar que **Eliana los dirija** cuando el estudiante los usa.

---

## El material — siempre en pantalla (eje visual)

Este es el texto y su marco pedagógico completo. Permanece visible en todo momento para que el profesor vea sobre qué actúa cada agente.

### Diálogo · "¿Dónde quedamos?" *(A1, cotidiano)*

> ■ Hola, Luisa, ¿qué tal?
> ● Hola, ¿qué haces?
> ■ Nada, estoy viendo una serie.
> ● Oye, ¿vamos al centro esta tarde?
> ■ Estupendo, podemos ir al cine.
> ● Vale, ¿cómo quedamos?
> ■ ¿A las cinco en la puerta del metro?
> ● No, mejor a las seis. ¿Te parece bien?
> ■ De acuerdo. Quedamos a las seis. ¡Hasta luego!

### Enunciado

**Contesta a las preguntas:**

1. ¿Qué van a hacer Luisa y su amiga?
2. ¿Dónde quedan?
3. ¿A qué hora?

---

## Reparto de roles

- **El profesor crea** cada agente con un objetivo pedagógico.
- **El profesor decide** dónde aplicarlo — en qué texto, en qué actividad.
- **Eliana dirige** la orquesta cuando el estudiante entra.

---

## Los 5 agentes creados para este material

Se explican alrededor del bloque central (que sigue visible).

- **Traducción pedagógica** — traduce solo las frases del diálogo que el estudiante marca como no entendidas.
- **Arqueología del texto** — excava los campos semánticos del diálogo: saludos, planes, negociación, despedidas.
- **Comprensión lectora global** — el estudiante reconstruye la secuencia del diálogo con imágenes.
- **Mapa mental** — convierte el diálogo en un recorrido comunicativo paso a paso.
- **Gramapop** — explica un punto gramatical del texto conversando, en la lengua del estudiante.

> Cinco decisiones pedagógicas del profesor sobre el mismo diálogo y las mismas preguntas que hay en pantalla. Cuando el estudiante entra, Eliana los dirige.

---

## Lo que gana el profe

- **Eres el autor**, no el usuario.
- **Tu material, tu decisión.**
- **Eliana ejecuta, tú diriges la intención.**
- **Un texto puede tener uno, cinco o veinte agentes.**

---

## CTA · Pruébalo en directo

**Botón principal**:

> **Probar este ejemplo →** [https://materiaeles.netlify.app/ejercicios.html?v=2](https://materiaeles.netlify.app/ejercicios.html?v=2)

**Microcopy debajo del botón**:

> *Escanea el QR. Verás los cinco agentes aplicados al diálogo y las preguntas que tienes en pantalla, dirigidos por Eliana.*

---

## Filosofía

- **El profesor crea.**
- **El profesor aplica.**
- **Eliana dirige.**

---

## Cierre

**Los agentes son tuyos. El aula es tuya. Eliana se encarga del resto.**

---

## Notas para el diseño visual de la diapo

- El **bloque central** (diálogo + enunciado + 3 preguntas) es el elemento protagonista. Nunca se oculta ni se reduce.
- Los **5 agentes** aparecen como satélites alrededor del bloque — cards pequeñas con icono y frase de una línea.
- **Eliana** con avatar pequeño cerca del bloque central; rol de capitana visible.
- El **CTA** (botón + QR) al final, bien destacado.

---

## Especificación del QR (para quien lo implemente)

| Parámetro | Valor |
|-----------|-------|
| **URL destino** | `https://materiaeles.netlify.app/ejercicios.html?v=2` |
| **Rutado** | Ideal: deep link que abra directamente la actividad 2 del diálogo U7A sin pasos intermedios. Si la URL actual lleva al índice general, verificar o añadir anchor/param (ej. `#u7a-dialog-act2`) y que `app.js` lo detecte al cargar para abrir el modal correcto. |
| **Tamaño mínimo** | 250×250 px para escaneo cómodo desde proyector. |
| **Formato** | SVG (escalable) + PNG de respaldo. |
| **Estilo** | Negro sobre blanco, alto contraste, marco limpio. |
| **Herramienta** | Cualquier generador online o librería JS (qrcode.js). |
| **Verificación previa al taller** | Probar desde iPhone y Android; confirmar que abre la actividad del diálogo sin pasos extra. |
