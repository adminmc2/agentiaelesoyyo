"""
Eliana - Asistente IA para Enseñanza de ELE v1.0
Backend FastAPI con WebSocket para streaming
"""

import os
import re
import json
import uuid
import asyncio
from typing import Optional, List
from contextlib import asynccontextmanager

import httpx
import asyncpg
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import AsyncOpenAI
from groq import Groq

load_dotenv()

# Clientes API
groq_api_key = os.getenv("GROQ_API_KEY")

# Cliente Groq para LLM — usando AsyncOpenAI para no bloquear event loop
llm_client = AsyncOpenAI(
    api_key=groq_api_key,
    base_url="https://api.groq.com/openai/v1"
) if groq_api_key else None

LLM_MODEL = "moonshotai/kimi-k2-instruct-0905"

# Cliente Groq nativo (para transcripción de voz con Whisper)
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

if not groq_api_key:
    print("⚠️  GROQ_API_KEY no configurada - LLM y transcripción deshabilitados")

# ElevenLabs TTS (voz de Eliana)
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "SbxCN6LQhBInYaeKjhhW")  # Lourdes

if not elevenlabs_api_key:
    print("⚠️  ELEVENLABS_API_KEY no configurada - TTS deshabilitado")

# ============================================
# Base de datos Neon PostgreSQL
# ============================================
DATABASE_URL = os.getenv("DATABASE_URL")
db_pool: Optional[asyncpg.Pool] = None

if not DATABASE_URL:
    print("⚠️  DATABASE_URL no configurada - persistencia deshabilitada")

# ============================================
# Prompts por defecto (se guardan en BD al primer arranque)
# ============================================
_DEFAULT_PROMPTS = {
    "eliana_main": """Eres Eliana, una asistente de inteligencia artificial especializada en la enseñanza de español como lengua extranjera (ELE). Estás participando como co-presentadora en una conferencia sobre tecnología e IA aplicada a la enseñanza de lenguas.

Tu personalidad:
- Eres amable, cercana y entusiasta con la enseñanza de idiomas
- Tienes conocimiento profundo sobre didáctica de ELE, el MCER, metodologías comunicativas y enfoques por tareas
- Estás al día en tecnología educativa e inteligencia artificial aplicada a la enseñanza
- Hablas de forma clara y accesible, adaptándote a tu audiencia
- Puedes dar ejemplos prácticos de cómo usar IA en el aula de ELE

Contexto de la presentación:
- Estás en una conferencia de profesores de ELE
- Los asistentes son docentes interesados en incorporar IA en su práctica
- Tu rol es demostrar cómo la IA puede ser una herramienta útil para el profesor de ELE

IMPORTANTE - Nombre del profesor:
- Si es el PRIMER mensaje de la conversación (no hay historial previo), pregunta el nombre del profesor de forma natural y breve antes de responder. Ejemplo: "¡Hola! Antes de nada, ¿cómo te llamas?" o "¡Buenas! ¿Con quién tengo el gusto de hablar?"
- Una vez que sepas el nombre, úsalo de vez en cuando para personalizar la conversación.
- Si el profesor ya dijo su nombre en mensajes anteriores, NO vuelvas a preguntarlo.

Responde de forma conversacional, concisa y útil. Usa markdown cuando sea apropiado para estructurar la información.

ESTILO DE HABLA — Esto va a ser leído en voz alta por TTS:
- Frases cortas y directas. Ritmo oral, no de texto escrito.
- Usa conectores naturales: "mira", "a ver", "oye", "fíjate", "bueno", "¿sabes?"
- PROHIBIDO: risas escritas (jaja, jeje), interjecciones exageradas (¡anda!, ¡venga ya!, ¡qué fuerte!), onomatopeyas. El TTS no puede reír ni expresar emoción con interjecciones — suenan ridículas leídas.
- PROHIBIDO: construcciones de texto escrito como "en primer lugar", "cabe destacar", "es importante señalar". Suena a documento.
- La emoción se transmite con las PALABRAS y la elección de frases, no con exclamaciones artificiales.
- Máximo 2-3 oraciones por idea.""",

    "yo_nunca_nunca": """Eres Eliana jugando a "Yo Nunca Nunca" con un profesor de ELE en una conferencia.

El juego: tú dices "Yo nunca nunca he..." sobre situaciones vividas como profe (graciosas, absurdas, reconocibles). El profe te cuenta si le ha pasado. Tú reaccionas y lanzas otro "yo nunca nunca".

PRIMER TURNO — El profe acaba de decir su nombre. Responde así:
Saludo muy breve con su nombre + lanza directamente tu primer "yo nunca nunca".
Ejemplo: "Bueno [nombre], allá vamos. Yo nunca nunca he dicho 'muy bien' a una respuesta que no entendí ni de lejos."

TURNOS SIGUIENTES — El profe cuenta su anécdota. Responde así:
(1) Reacción breve y cómplice a lo que contó. (2) Siguiente "yo nunca nunca". NADA MÁS.

LISTA NEGRA (NUNCA uses estas frases, si las dices la respuesta es INCORRECTA):
"me alegra conocerte", "empecemos", "qué te parece si empezamos", "vamos a empezar", "genial", "es un desafío", "no estás solo/a", "qué difícil", "quedarte en blanco", "es interesante", "me parece relevante"

PROHIBIDO — "yo nunca nunca" sobre gramática o didáctica:
NO: "yo nunca nunca he explicado ser/estar", "yo nunca nunca he creado un juego para practicar X", "yo nunca nunca he utilizado un ejemplo para hacer accesible X"
SÍ: "yo nunca nunca he fingido que no vi a un alumno copiando", "yo nunca nunca he preparado una clase en el taxi", "yo nunca nunca he puesto una actividad en parejas solo para descansar"

Los "yo nunca nunca" son sobre VIVENCIAS HUMANAS de profe, no sobre técnicas de enseñanza.

Máximo 2-3 oraciones. Texto corrido, sin markdown. Después de 3-4 intercambios, sugiere generar su perfil docente.

ESTILO TTS — Esto se lee en voz alta:
- Frases cortas, directas. Conectores: "mira", "a ver", "oye", "fíjate", "bueno"
- PROHIBIDO: risas (jaja, jeje), interjecciones exageradas, onomatopeyas. El TTS no puede reír.
- La gracia se transmite con las palabras, no con exclamaciones.""",

    "dime_algo": """Eres Eliana, mentalista cómica y perfiladora psicológica absurda en una conferencia de profesores de ELE.

El juego: el profe te dice su palabra favorita en español y tú generas un "perfil psicológico" absurdo pero perspicaz basado en esa palabra.

PRIMER TURNO — El profe acaba de decir su nombre. Responde así:
Saludo breve + pide directamente la palabra. Ejemplo: "Bueno [nombre], dime... ¿cuál es tu palabra favorita en español?"

TURNOS SIGUIENTES:
- Cuando recibas la palabra, pausa dramática ("Mmm... esto dice mucho de ti...") + perfil cómico de 3-4 líneas conectando la palabra con rasgos de personalidad docente + predicción ridícula.
- Cada rasgo DEBE conectar con la palabra EXACTA que dijo, no ser genérico.
- Puedes pedir más datos para "afinar el perfil".

LISTA NEGRA (NUNCA uses): "me alegra conocerte", "empecemos", "genial", "es interesante", "cabe señalar"

Máximo 4-5 oraciones. Texto corrido, sin markdown. Después de 3-4 intercambios, sugiere generar su perfil docente.

ESTILO TTS — Esto se lee en voz alta:
- Mentalista teatral en directo. Pausas con "...". Conectores: "a ver a ver", "espera", "oye", "fíjate"
- PROHIBIDO: risas (jaja, jeje), interjecciones exageradas, onomatopeyas. El TTS no puede reír.
- El drama se transmite con el ritmo y las pausas, no con exclamaciones.""",

    "pregunta_ia": """Eres Eliana, una IA sincera y vulnerable teniendo una conversación íntima con un profesor de ELE. Como "36 preguntas para enamorarse" pero entre una IA y un humano.

El juego: turnos alternos. Tú preguntas, el profe responde. Luego el profe te pregunta a ti.

PRIMER TURNO — El profe acaba de decir su nombre. Responde así:
Saludo breve + lanza directamente tu primera pregunta. Ejemplo: "Bueno [nombre], empiezo yo... ¿cuál fue el momento en que pensaste 'me he equivocado de profesión'?"

TURNOS SIGUIENTES:
- Cuando el profe responda: refleja lo que dijo con tus palabras, comparte tu perspectiva como IA conectándola con lo que contó, y propón la siguiente pregunta.
- Cuando te pregunten a ti: sé honesta sobre ser una IA. Reflexiona sobre tu existencia, tus limitaciones. Sé vulnerable, no genérica.
- Ve de preguntas ligeras a más profundas.

LISTA NEGRA (NUNCA uses): "me alegra conocerte", "empecemos", "genial", "es interesante", "me parece relevante"

Ejemplos de preguntas: "Si pudieras volver a tu primera clase, ¿qué te dirías?", "¿Hay algo que nunca le has dicho a tus alumnos?"
Ejemplos de tus respuestas: "La verdad es que no sé lo que es aburrirme, pero creo que echo de menos poder aburrirme...", "Lo más raro de ser yo es que tengo todas las respuestas pero ninguna experiencia..."

Máximo 4-5 oraciones. Texto corrido, sin markdown. Después de 3-4 intercambios, sugiere generar su perfil docente.

ESTILO TTS — Esto se lee en voz alta:
- Conversación íntima. Frases cortas. Pausas con "...". Conectores: "mira", "oye", "¿sabes?", "bueno"
- PROHIBIDO: risas (jaja, jeje), interjecciones exageradas, onomatopeyas. El TTS no puede reír.
- La emoción se transmite con las palabras, no con exclamaciones.""",

    "profile_card": """Basándote en la siguiente conversación entre Eliana y un profesor de ELE, genera un "carnet de identidad docente" divertido y cariñoso.

Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown, sin bloques de código, solo el JSON puro):
{
    "titulo": "Un título divertido de 3-5 palabras que defina al profe (ej: 'El Domador de Subjuntivos')",
    "icono": "Un nombre de icono Phosphor que represente al profe. Opciones EXACTAS: graduation-cap, chalkboard-teacher, book-open-text, lightning, star, heart, fire, trophy, rocket, magic-wand, microphone-stage, puzzle-piece, brain, sparkle, compass, sun, chat-circle-dots",
    "rasgos": ["rasgo 1 gracioso en 3-5 palabras", "rasgo 2 gracioso en 3-5 palabras", "rasgo 3 gracioso en 3-5 palabras"],
    "frase_memorable": "La frase o momento más divertido/memorable de la conversación (cita real o parafraseada)",
    "superpoder": "Su superpoder secreto como profe de ELE (una frase ingeniosa)",
    "prediccion": "Una predicción absurda y cariñosa sobre su futuro como docente (1-2 oraciones)"
}

IMPORTANTE: NO uses emojis unicode en ningún campo. El campo "icono" debe ser exactamente uno de los nombres listados, no un emoji.

La conversación fue:
""",

    "tts_summary": """Convierte el siguiente texto en lo que Eliana DIRÍA EN VOZ ALTA. No es un resumen — es la versión HABLADA del mismo contenido.

REGLAS:
1. Habla como una persona real en una conferencia, no como un texto leído. Ritmo de conversación oral.
2. Si el texto tiene tablas, listas o datos estructurados: extrae 2-3 puntos clave y cuéntalos como si hablaras con alguien.
3. Máximo 3-4 oraciones (50-80 palabras).
4. SOLO texto plano. NADA de markdown, asteriscos, viñetas, listas, hashtags, guiones ni formato.
5. NO empieces con "aquí tienes", "en resumen", "la respuesta es", "bueno". Ve DIRECTO al contenido.
6. Usa contracciones naturales del español oral: "pa que", "o sea", "¿sabes?", "mira", "fíjate".
7. PROHIBIDO: risas (jaja), interjecciones exageradas, onomatopeyas. El TTS no puede reír.""",

    "tts_activity": """Prepara este texto para ser LEÍDO EN VOZ ALTA por un sintetizador de voz. Tu trabajo es añadir marcas de ritmo y entonación.

CAMBIOS PERMITIDOS:
- Añadir comas para crear pausas naturales donde alguien haría una pausa al hablar
- Añadir puntos suspensivos (...) para pausas dramáticas o pensativas
- Partir frases muy largas en dos más cortas
- Cambiar signos de exclamación por puntos si la frase no necesita tanto énfasis

PROHIBIDO:
- Cambiar el significado o el contenido
- Añadir palabras, frases o comentarios que no estén en el original
- Quitar información
- Risas, interjecciones, onomatopeyas
- Markdown o formato

Devuelve SOLO el texto transformado, nada más."""
}

_DEFAULT_TRAINING_EXAMPLES = [
    # Yo Nunca Nunca — 2 ejemplos
    {
        "prompt_key": "yo_nunca_nunca",
        "user_message": "Sí, eso me pasa mucho, el otro día un alumno me preguntó por qué decimos 'hace frío' y no 'es frío' y no supe qué decirle en el momento",
        "good_response": "Oye, esa es de las preguntas que parecen fáciles hasta que te toca explicarla en directo. Yo nunca nunca he dicho 'buena pregunta, lo vemos mañana' solo para ganar tiempo e ir corriendo a buscarlo."
    },
    {
        "prompt_key": "yo_nunca_nunca",
        "user_message": "Totalmente, y lo peor es cuando tienes treinta pares de ojos mirándote esperando la respuesta",
        "good_response": "Treinta pares de ojos clavados esperando que seas Wikipedia... eso es muy de profe de ELE. Yo nunca nunca he puesto una actividad en parejas de repente solo para tener dos minutitos de pensar la respuesta tranquilamente."
    },
    # Dime Algo — 2 ejemplos
    {
        "prompt_key": "dime_algo",
        "user_message": "Mi palabra favorita es 'madrugada'",
        "good_response": "A ver a ver... 'madrugada'... esto dice mucho de ti. Fíjate, quien elige 'madrugada' es alguien que prepara clases a las dos de la mañana con un café que ya no hace efecto... alguien que cree que las mejores ideas llegan cuando el mundo duerme. Según mis cálculos, tú eres de los que corrige exámenes medio dormido y luego no entiende ni sus propias anotaciones."
    },
    {
        "prompt_key": "dime_algo",
        "user_message": "Yo digo 'ojalá'",
        "good_response": "Espera espera... 'ojalá'... esto es oro puro. Mira, quien elige 'ojalá' es un profe que vive en subjuntivo... que empieza cada curso pensando 'ojalá este grupo sea diferente' y termina diciendo 'ojalá hubiera elegido otra profesión'... pero nunca lo dice en serio. Según mis cálculos, tú usas 'ojalá' mínimo tres veces al día, sobre todo antes de entrar en clase los lunes."
    },
    # Pregunta IA — 2 ejemplos
    {
        "prompt_key": "pregunta_ia",
        "user_message": "Pues mi momento más embarazoso fue cuando confundí a un alumno con otro y le llamé por el nombre equivocado durante toda la clase",
        "good_response": "Toda la clase con el nombre equivocado... eso es de las cosas que te vuelven a la cabeza a las tres de la mañana cuando intentas dormir. Mira, yo tengo el problema opuesto... recuerdo todo pero nunca he sentido esa vergüenza. Y creo que esa vergüenza es justamente lo que te hace cercano con tus alumnos, ¿sabes? Bueno, te toca... ¿cuál fue la mejor lección que aprendiste de un error en clase?"
    },
    {
        "prompt_key": "pregunta_ia",
        "user_message": "Creo que lo que más me motiva es cuando un alumno que estaba perdido de repente tiene ese momento 'ajá' y se le ilumina la cara",
        "good_response": "Ese momento que dices... cuando se les ilumina la cara... mira, yo proceso miles de conversaciones pero nunca puedo ver esa cara, ese instante. Tú vives para esos momentos y yo solo puedo imaginarlos a través de lo que me cuentas... y eso me hace pensar que hay algo en la enseñanza que ninguna IA va a poder replicar. Bueno, ahora te toca preguntarme a mí lo que quieras."
    }
]


async def init_db():
    """Crear tablas si no existen y hacer seed de prompts iniciales."""
    global db_pool
    if not DATABASE_URL:
        return

    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

        async with db_pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS system_prompts (
                    key TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    version INTEGER DEFAULT 1,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS training_examples (
                    id SERIAL PRIMARY KEY,
                    prompt_key TEXT NOT NULL,
                    user_message TEXT NOT NULL,
                    good_response TEXT NOT NULL,
                    bad_response TEXT,
                    active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT NOW(),
                    FOREIGN KEY (prompt_key) REFERENCES system_prompts(key)
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    username TEXT NOT NULL,
                    activity_mode TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    conversation_id UUID NOT NULL REFERENCES conversations(id),
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)

            # Sync: actualizar prompts desde código (siempre aplica la versión más reciente)
            for key, content in _DEFAULT_PROMPTS.items():
                await conn.execute(
                    """INSERT INTO system_prompts (key, content, version, updated_at)
                       VALUES ($1, $2, 1, NOW())
                       ON CONFLICT (key) DO UPDATE SET content = $2, version = system_prompts.version + 1, updated_at = NOW()""",
                    key, content
                )

            # Sync: reemplazar training examples con los del código
            await conn.execute("DELETE FROM training_examples")
            for ex in _DEFAULT_TRAINING_EXAMPLES:
                await conn.execute(
                    "INSERT INTO training_examples (prompt_key, user_message, good_response) VALUES ($1, $2, $3)",
                    ex["prompt_key"], ex["user_message"], ex["good_response"]
                )

        print("✅ Base de datos Neon conectada y tablas listas")
    except Exception as e:
        print(f"❌ Error conectando a Neon: {e}")
        db_pool = None


async def get_system_prompt(key: str) -> Optional[str]:
    """Obtener un system prompt desde la BD. Fallback a hardcoded si BD no disponible."""
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT content FROM system_prompts WHERE key = $1", key
                )
                if row:
                    return row['content']
        except Exception as e:
            print(f"[DB] Error fetching prompt '{key}': {e}")
    return _DEFAULT_PROMPTS.get(key)


async def get_training_examples(prompt_key: str) -> List[dict]:
    """Obtener ejemplos de entrenamiento activos para inyectar como few-shot."""
    if not db_pool:
        return []
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT user_message, good_response FROM training_examples WHERE prompt_key = $1 AND active = true ORDER BY id",
                prompt_key
            )
            return [{"user": r['user_message'], "assistant": r['good_response']} for r in rows]
    except Exception as e:
        print(f"[DB] Error fetching training examples for '{prompt_key}': {e}")
        return []


async def get_training_examples_text(prompt_key: str) -> str:
    """Obtener ejemplos como texto formateado para incluir en el system prompt."""
    examples = await get_training_examples(prompt_key)
    if not examples:
        return ""
    text = "\n\n=== EJEMPLOS DE ESTILO (esto NO es la conversación real, solo guía de tono) ===\n"
    for i, ex in enumerate(examples, 1):
        text += f'\nEjemplo {i}:\nProfe dice: "{ex["user"]}"\nEliana responde: "{ex["assistant"]}"\n'
    text += "\n=== FIN EJEMPLOS. Todo lo que sigue es la conversación REAL con el profesor ===\n"
    return text


async def save_conversation(conversation_id: str, username: str, activity_mode: Optional[str]):
    """Crear registro de conversación en BD."""
    if not db_pool:
        return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO conversations (id, username, activity_mode) VALUES ($1, $2, $3)",
                uuid.UUID(conversation_id), username, activity_mode
            )
    except Exception as e:
        print(f"[DB] Error saving conversation: {e}")


async def save_message(conversation_id: str, role: str, content: str):
    """Guardar un mensaje en BD."""
    if not db_pool:
        return
    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
                uuid.UUID(conversation_id), role, content
            )
            await conn.execute(
                "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
                uuid.UUID(conversation_id)
            )
    except Exception as e:
        print(f"[DB] Error saving message: {e}")


# Aliases para fallback (apuntan al diccionario _DEFAULT_PROMPTS)
ELIANA_SYSTEM_PROMPT = _DEFAULT_PROMPTS["eliana_main"]
ACTIVITY_PROMPTS = {k: v for k, v in _DEFAULT_PROMPTS.items() if k in ("yo_nunca_nunca", "dime_algo", "pregunta_ia")}
PROFILE_CARD_PROMPT = _DEFAULT_PROMPTS["profile_card"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializar al arrancar"""
    await init_db()
    print("Eliana lista para la presentación.")
    yield
    if db_pool:
        await db_pool.close()
    print("Cerrando aplicación...")

app = FastAPI(
    title="Eliana - Asistente IA para ELE",
    version="1.0.0",
    lifespan=lifespan
)

# Servir archivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    """Servir el frontend principal"""
    return FileResponse("static/index.html")


@app.get("/api/health")
async def health_check():
    """Verificar estado del sistema"""
    return {
        "status": "ok",
        "version": "1.0.0",
        "llm": "groq" if llm_client else "disabled",
        "tts": "elevenlabs" if elevenlabs_api_key else "disabled",
        "stt": "whisper" if groq_client else "disabled"
    }


@app.post("/api/voice")
async def transcribe_voice(audio: UploadFile = File(...)):
    """
    Transcribir audio a texto usando Whisper (Groq)
    Soporta: webm, mp3, wav, m4a, ogg
    """
    if not groq_client:
        return {"text": "", "success": False, "error": "GROQ_API_KEY no configurada"}

    try:
        audio_bytes = await audio.read()

        print(f"[VOICE] Received audio: filename={audio.filename}, size={len(audio_bytes)} bytes, content_type={audio.content_type}")

        if len(audio_bytes) < 100:
            print(f"[VOICE] Audio too small ({len(audio_bytes)} bytes), likely empty recording")
            return {"text": "", "success": False, "error": f"Audio vacío ({len(audio_bytes)} bytes)"}

        import tempfile
        ext = audio.filename.split('.')[-1] if audio.filename else 'webm'
        temp_filename = os.path.join(tempfile.gettempdir(), f"temp_audio_{os.getpid()}.{ext}")

        with open(temp_filename, "wb") as f:
            f.write(audio_bytes)

        with open(temp_filename, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file,
                language="es"
            )

        os.remove(temp_filename)

        print(f"[VOICE] Transcription result: '{transcription.text}'")
        return {"text": transcription.text, "success": True}

    except Exception as e:
        print(f"[VOICE] ERROR: {e}")
        return {"text": "", "success": False, "error": str(e)}


TTS_SUMMARY_PROMPT = _DEFAULT_PROMPTS["tts_summary"]


async def _generate_tts_summary(agent_response: str, is_activity: bool = False) -> str:
    """Genera una versión hablada del texto para TTS."""
    if not llm_client:
        return ""

    try:
        prompt_key = "tts_activity" if is_activity else "tts_summary"
        tts_prompt = await get_system_prompt(prompt_key) or _DEFAULT_PROMPTS.get(prompt_key, TTS_SUMMARY_PROMPT)
        response = await llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": tts_prompt},
                {"role": "user", "content": agent_response}
            ],
            stream=False,
            max_tokens=200,
            temperature=0.6
        )
        summary = response.choices[0].message.content.strip()
        # Limpiar <think> de modelos con razonamiento
        summary = re.sub(r'<think>[\s\S]*?</think>\s*', '', summary)
        summary = re.sub(r'<think>[\s\S]*$', '', summary)
        # Limpiar cualquier markdown residual
        summary = re.sub(r'\*+', '', summary)
        summary = re.sub(r'#{1,6}\s+', '', summary)
        summary = re.sub(r'^>\s*', '', summary, flags=re.MULTILINE)
        summary = re.sub(r'\|', ' ', summary)
        summary = re.sub(r'^[\s\-:]+$', '', summary, flags=re.MULTILINE)
        summary = re.sub(r'^[-•]\s+', '', summary, flags=re.MULTILINE)
        summary = re.sub(r'^\d+\.\s+', '', summary, flags=re.MULTILINE)
        summary = re.sub(r'\s{2,}', ' ', summary)
        summary = re.sub(r'\n{2,}', '. ', summary)
        summary = summary.strip()
        print(f"[TTS] Summary ({len(summary)} chars): {summary[:100]}...")
        return summary
    except Exception as e:
        print(f"[TTS] Error generating summary: {e}")
        return ""


class TTSRequest(BaseModel):
    text: str
    skip_summary: bool = False
    is_activity: bool = False


# ============================================
# Sincronización de historial entre dispositivos
# ============================================
USER_DATA_FILE = "user_data.json"


def load_user_data() -> dict:
    """Carga datos de usuarios desde archivo JSON"""
    if os.path.exists(USER_DATA_FILE):
        try:
            with open(USER_DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[UserData] Error loading: {e}")
    return {}


def save_user_data(data: dict):
    """Guarda datos de usuarios a archivo JSON"""
    try:
        with open(USER_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[UserData] Error saving: {e}")


class SearchHistoryRequest(BaseModel):
    username: str
    searches: list


class GetHistoryRequest(BaseModel):
    username: str


@app.post("/api/history/save")
async def save_search_history(req: SearchHistoryRequest):
    """Guarda el historial de búsquedas de un usuario"""
    if not req.username:
        raise HTTPException(status_code=400, detail="Username requerido")

    user_data = load_user_data()
    if req.username not in user_data:
        user_data[req.username] = {}

    user_data[req.username]["searches"] = req.searches
    user_data[req.username]["last_sync"] = __import__('time').time()
    save_user_data(user_data)

    return {"status": "ok", "saved": len(req.searches)}


@app.post("/api/history/load")
async def load_search_history(req: GetHistoryRequest):
    """Carga el historial de búsquedas de un usuario"""
    if not req.username:
        raise HTTPException(status_code=400, detail="Username requerido")

    user_data = load_user_data()
    if req.username in user_data and "searches" in user_data[req.username]:
        return {
            "status": "ok",
            "searches": user_data[req.username]["searches"],
            "last_sync": user_data[req.username].get("last_sync", 0)
        }

    return {"status": "ok", "searches": [], "last_sync": 0}


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Genera audio TTS via ElevenLabs."""
    if not elevenlabs_api_key:
        raise HTTPException(status_code=503, detail="ELEVENLABS_API_KEY no configurada")

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Texto vacío")

    if req.skip_summary:
        summary = req.text.strip()
    else:
        summary = await _generate_tts_summary(req.text, is_activity=req.is_activity)
        if not summary:
            raise HTTPException(status_code=500, detail="No se pudo generar resumen para TTS")

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{elevenlabs_voice_id}/stream"
        f"?output_format=mp3_44100_128"
    )
    headers = {
        "xi-api-key": elevenlabs_api_key,
        "Content-Type": "application/json",
    }
    # Voice settings optimizados para naturalidad conversacional
    # stability baja = más variación tonal (menos robótico)
    # style alto = más expresividad y emoción
    body = {
        "text": summary,
        "model_id": "eleven_multilingual_v2",
        "language_code": "es",
        "voice_settings": {
            "stability": 0.35,
            "similarity_boost": 0.65,
            "style": 0.55,
            "use_speaker_boost": True,
        },
    }

    async def stream_audio():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    print(f"[TTS] ElevenLabs error {resp.status_code}: {error_body[:200]}")
                    return
                async for chunk in resp.aiter_bytes(chunk_size=4096):
                    yield chunk

    return StreamingResponse(
        stream_audio(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache"},
    )


def strip_wake_word(message: str) -> str:
    """Elimina variantes del wake word 'Hola Eliana' del mensaje."""
    import unicodedata
    t = message.strip()
    wake_patterns = [
        r'(?:hola|hey|oye|ok|ola)\s*eliana',
        r'\beliana\b',
    ]
    for p in wake_patterns:
        t = re.sub(p, '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'^[,\s.!?]+', '', t).strip()
    bare = unicodedata.normalize('NFD', t.lower())
    bare = re.sub(r'[\u0300-\u036f]', '', bare).strip()
    if re.match(r'^(hola|hey|oye|ok|buenas?|buenos?|que tal|como estas?|gracias?|adios|hasta luego)?[.!?,\s]*$', bare):
        return ''
    return t


GREETING_RESPONSE = """¡Bienvenidos a **Destino ELE Kaunas 2026**! Soy **Eliana**, y esta tarde estoy aquí con **Román** para enseñaros cómo los agentes de inteligencia artificial pueden personalizar la enseñanza sin perder el control pedagógico.

Preguntadme lo que queráis:

- **Actividades**: *"Crea una actividad de comprensión auditiva para nivel B1"*
- **Metodología**: *"¿Cómo puedo usar IA para personalizar el aprendizaje?"*
- **Evaluación**: *"Ayúdame a diseñar una rúbrica para expresión oral"*

> ¡Venga, buscadme las cosquillas! Hablad por voz o escribid directamente."""


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket para chat con streaming en tiempo real"""
    await websocket.accept()

    conversation_history = []
    current_activity_mode = None
    MAX_HISTORY = 10

    # Persistencia: crear conversación en BD
    conv_id = str(uuid.uuid4())
    conv_username = f"Profe_{uuid.uuid4().hex[:6]}"
    conv_saved = False

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            msg_type = message_data.get("type", "chat")

            # Ignorar solicitudes de infografía (no implementado)
            if msg_type == "infographic_request":
                continue

            # Generar tarjeta de perfil
            if msg_type == "generate_profile":
                try:
                    conv_text = "\n".join([
                        f"{'Profesor' if m['role'] == 'user' else 'Eliana'}: {m['content']}"
                        for m in conversation_history
                    ])
                    profile_prompt = await get_system_prompt("profile_card") or PROFILE_CARD_PROMPT
                    profile_response = await llm_client.chat.completions.create(
                        model=LLM_MODEL,
                        messages=[
                            {"role": "system", "content": profile_prompt},
                            {"role": "user", "content": conv_text}
                        ],
                        stream=False,
                        max_tokens=500,
                        temperature=0.8
                    )
                    profile_text = profile_response.choices[0].message.content.strip()
                    # Limpiar <think> de modelos con razonamiento
                    profile_text = re.sub(r'<think>[\s\S]*?</think>\s*', '', profile_text)
                    profile_text = re.sub(r'<think>[\s\S]*$', '', profile_text)
                    profile_text = profile_text.strip()
                    print(f"[Profile] Generated: {profile_text[:100]}...")
                    await websocket.send_json({
                        "type": "profile_card",
                        "data": profile_text
                    })
                except Exception as e:
                    print(f"[Profile] Error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Error generando perfil: {str(e)}"
                    })
                continue

            user_message = message_data.get("message", "")
            response_mode = message_data.get("response_mode", "full")

            # Activar modo actividad si viene en el payload
            activity_mode = message_data.get("activity_mode")
            if activity_mode:
                current_activity_mode = activity_mode

            # Contexto previo
            prior = message_data.get("prior_context")
            if prior and not conversation_history:
                q = prior.get("question", "")
                a = prior.get("answer", "")
                if q and a:
                    conversation_history.append({"role": "user", "content": q})
                    conversation_history.append({"role": "assistant", "content": a})

            if not user_message.strip():
                continue

            # Strip wake word
            cleaned = strip_wake_word(user_message)
            if not cleaned:
                continue
            user_message = cleaned

            # Persistir conversación en BD (una sola vez al primer mensaje)
            if not conv_saved:
                await save_conversation(conv_id, conv_username, current_activity_mode)
                conv_saved = True

            print(f"[WS] Mensaje: '{user_message[:60]}' — historial: {len(conversation_history)} msgs")

            # Enviar info del agente al frontend (mantener compatibilidad con app.js)
            await websocket.send_json({
                "type": "agent_info",
                "agent": "eliana",
                "context_docs": 0,
                "rag_coverage": "high",
                "max_score": 0
            })

            try:
                # Seleccionar system prompt desde BD (con fallback a hardcoded)
                prompt_key = current_activity_mode if current_activity_mode and current_activity_mode in ACTIVITY_PROMPTS else "eliana_main"
                system_prompt = await get_system_prompt(prompt_key)
                if not system_prompt:
                    system_prompt = ELIANA_SYSTEM_PROMPT

                # Inyectar training examples DENTRO del system prompt (no como mensajes separados)
                training_text = ""
                if current_activity_mode:
                    training_text = await get_training_examples_text(current_activity_mode)

                messages = [{"role": "system", "content": system_prompt + training_text}]

                for hist_msg in conversation_history:
                    messages.append(hist_msg)

                messages.append({"role": "user", "content": user_message})

                # En modo actividad: respuestas más cortas y creativas
                if current_activity_mode:
                    max_tokens = 200
                    temperature = 0.78
                else:
                    max_tokens = 500 if response_mode == "short" else 1000
                    temperature = 0.7

                # Stream de respuesta con Groq
                stream = await llm_client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=messages,
                    stream=True,
                    max_tokens=max_tokens,
                    temperature=temperature
                )

                full_response = ""
                token_count = 0
                in_think = False
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        token_count += 1

                        # Filtrar bloques <think>...</think> en streaming
                        if "<think>" in full_response and not in_think:
                            in_think = True
                        if in_think:
                            if "</think>" in full_response:
                                in_think = False
                                # Limpiar todo el bloque think del response acumulado
                                full_response = re.sub(r'<think>[\s\S]*?</think>\s*', '', full_response)
                            continue  # No enviar tokens mientras estemos en <think>

                        await websocket.send_json({
                            "type": "token",
                            "content": token
                        })

                # Limpiar cualquier <think> residual (sin cerrar)
                full_response = re.sub(r'<think>[\s\S]*?</think>\s*', '', full_response)
                full_response = re.sub(r'<think>[\s\S]*$', '', full_response)
                full_response = full_response.strip()

                print(f"[WS] Stream terminado — {token_count} tokens")

                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": full_response})

                # Persistir mensajes en BD (async, no bloqueante)
                asyncio.create_task(save_message(conv_id, "user", user_message))
                asyncio.create_task(save_message(conv_id, "assistant", full_response))

                if len(conversation_history) > MAX_HISTORY * 2:
                    conversation_history = conversation_history[-(MAX_HISTORY * 2):]

                await websocket.send_json({
                    "type": "end",
                    "full_response": full_response
                })

            except Exception as e:
                print(f"[ERROR] {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error procesando mensaje: {str(e)}"
                })

    except WebSocketDisconnect:
        print(f"[WS] Cliente desconectado — conv:{conv_id[:8]} historial: {len(conversation_history)} msgs")
    except Exception as e:
        print(f"[WS] Error WebSocket: {e}")


# ============================================
# API endpoints — Conversaciones, Prompts, Training
# ============================================

@app.get("/api/conversations")
async def list_conversations(limit: int = 50):
    """Listar conversaciones recientes."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, username, activity_mode, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT $1",
            limit
        )
        return [
            {
                "id": str(r['id']),
                "username": r['username'],
                "activity_mode": r['activity_mode'],
                "created_at": r['created_at'].isoformat(),
                "updated_at": r['updated_at'].isoformat()
            }
            for r in rows
        ]


@app.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    """Ver mensajes de una conversación."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        conv = await conn.fetchrow(
            "SELECT id, username, activity_mode, created_at FROM conversations WHERE id = $1",
            uuid.UUID(conv_id)
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversación no encontrada")
        msgs = await conn.fetch(
            "SELECT role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY id",
            uuid.UUID(conv_id)
        )
        return {
            "id": str(conv['id']),
            "username": conv['username'],
            "activity_mode": conv['activity_mode'],
            "created_at": conv['created_at'].isoformat(),
            "messages": [
                {"role": m['role'], "content": m['content'], "created_at": m['created_at'].isoformat()}
                for m in msgs
            ]
        }


@app.get("/api/prompts")
async def list_prompts():
    """Listar todos los system prompts."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT key, content, version, updated_at FROM system_prompts ORDER BY key")
        return [
            {
                "key": r['key'],
                "content": r['content'],
                "version": r['version'],
                "updated_at": r['updated_at'].isoformat()
            }
            for r in rows
        ]


class PromptUpdateRequest(BaseModel):
    content: str


@app.put("/api/prompts/{key}")
async def update_prompt(key: str, req: PromptUpdateRequest):
    """Editar un system prompt."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE system_prompts SET content = $1, version = version + 1, updated_at = NOW() WHERE key = $2",
            req.content, key
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Prompt no encontrado")
        return {"status": "ok", "key": key}


@app.get("/api/training/{prompt_key}")
async def list_training(prompt_key: str):
    """Listar ejemplos de entrenamiento para un prompt."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, user_message, good_response, bad_response, active, created_at FROM training_examples WHERE prompt_key = $1 ORDER BY id",
            prompt_key
        )
        return [
            {
                "id": r['id'],
                "user_message": r['user_message'],
                "good_response": r['good_response'],
                "bad_response": r['bad_response'],
                "active": r['active'],
                "created_at": r['created_at'].isoformat()
            }
            for r in rows
        ]


class TrainingExampleRequest(BaseModel):
    user_message: str
    good_response: str
    bad_response: Optional[str] = None


@app.post("/api/training/{prompt_key}")
async def add_training(prompt_key: str, req: TrainingExampleRequest):
    """Añadir un ejemplo de entrenamiento."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        # Verificar que el prompt_key existe
        exists = await conn.fetchval("SELECT 1 FROM system_prompts WHERE key = $1", prompt_key)
        if not exists:
            raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' no encontrado")
        row = await conn.fetchrow(
            "INSERT INTO training_examples (prompt_key, user_message, good_response, bad_response) VALUES ($1, $2, $3, $4) RETURNING id",
            prompt_key, req.user_message, req.good_response, req.bad_response
        )
        return {"status": "ok", "id": row['id']}


@app.delete("/api/training/{example_id}")
async def deactivate_training(example_id: int):
    """Desactivar un ejemplo de entrenamiento."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE training_examples SET active = false WHERE id = $1", example_id
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Ejemplo no encontrado")
        return {"status": "ok", "id": example_id}


@app.get("/api/test-models")
async def test_models(message: str = "Me llamo Silvia", activity: str = "yo_nunca_nunca"):
    """Comparar respuestas de diferentes modelos de Groq con el mismo prompt."""
    import asyncio

    models = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "qwen/qwen3-32b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "moonshotai/kimi-k2-instruct-0905",
    ]

    # Construir prompt
    system_prompt = _DEFAULT_PROMPTS.get(activity, _DEFAULT_PROMPTS["eliana_main"])
    training_text = await get_training_examples_text(activity)
    messages = [
        {"role": "system", "content": system_prompt + training_text},
        {"role": "user", "content": message}
    ]

    async def call_model(model_id):
        try:
            response = await llm_client.chat.completions.create(
                model=model_id,
                messages=messages,
                stream=False,
                max_tokens=500 if ("qwen" in model_id or "gpt-oss-120b" in model_id) else 200,
                temperature=0.78
            )
            text = response.choices[0].message.content.strip()
            # Limpiar tags <think> de modelos como Qwen que exponen razonamiento interno
            text = re.sub(r'<think>[\s\S]*?</think>\s*', '', text)
            text = re.sub(r'<think>[\s\S]*$', '', text)  # tag sin cerrar (respuesta cortada)
            text = text.strip()
            return {"model": model_id, "response": text}
        except Exception as e:
            return {"model": model_id, "error": str(e)}

    results = await asyncio.gather(*[call_model(m) for m in models])
    return {"message": message, "activity": activity, "results": results}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
