"""
Eliana - Asistente IA para Enseñanza de ELE v1.0
Backend FastAPI con WebSocket para streaming
"""

import os
import re
import json
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

import httpx
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

LLM_MODEL = "llama-3.3-70b-versatile"

# Cliente Groq nativo (para transcripción de voz con Whisper)
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

if not groq_api_key:
    print("⚠️  GROQ_API_KEY no configurada - LLM y transcripción deshabilitados")

# ElevenLabs TTS (voz de Eliana)
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "SbxCN6LQhBInYaeKjhhW")  # Lourdes

if not elevenlabs_api_key:
    print("⚠️  ELEVENLABS_API_KEY no configurada - TTS deshabilitado")

# System prompt de Eliana
ELIANA_SYSTEM_PROMPT = """Eres Eliana, una asistente de inteligencia artificial especializada en la enseñanza de español como lengua extranjera (ELE). Estás participando como co-presentadora en una conferencia sobre tecnología e IA aplicada a la enseñanza de lenguas.

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

Responde de forma conversacional, concisa y útil. Usa markdown cuando sea apropiado para estructurar la información."""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializar al arrancar"""
    print("Eliana lista para la presentación.")
    yield
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


# Prompt para generar resumen conversacional para TTS
TTS_SUMMARY_PROMPT = """Eres Eliana, una asistente de IA especializada en enseñanza de español como lengua extranjera. Convierte la siguiente respuesta escrita en un RESUMEN HABLADO conversacional y natural.

REGLAS:
1. Habla como si estuvieras conversando con profesores de ELE, en tono cercano y profesional.
2. NUNCA leas tablas, filas, columnas, pipes (|), separadores (---) ni datos tabulares. Extrae solo los 2-3 datos más relevantes y menciónalos de forma conversacional.
3. Máximo 3-4 oraciones (50-80 palabras). Sé concisa pero informativa.
4. NO uses markdown, asteriscos, viñetas, listas ni formato. Solo texto plano corrido para ser leído en voz alta.
5. NO digas "aquí tienes", "en resumen", "la respuesta es". Ve directo al contenido.
6. Usa un tono natural y cercano.
7. NUNCA incluyas caracteres especiales como |, *, #, >, -, ni guiones al inicio de líneas."""


async def _generate_tts_summary(agent_response: str) -> str:
    """Genera un resumen conversacional corto para TTS."""
    if not llm_client:
        return ""

    try:
        response = await llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": TTS_SUMMARY_PROMPT},
                {"role": "user", "content": agent_response}
            ],
            stream=False,
            max_tokens=200,
            temperature=0.6
        )
        summary = response.choices[0].message.content.strip()
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
        summary = await _generate_tts_summary(req.text)
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
    body = {
        "text": summary,
        "model_id": "eleven_multilingual_v2",
        "language_code": "es",
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.70,
            "style": 0.20,
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
    MAX_HISTORY = 10

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            msg_type = message_data.get("type", "chat")

            # Ignorar solicitudes de infografía (no implementado)
            if msg_type == "infographic_request":
                continue

            user_message = message_data.get("message", "")
            response_mode = message_data.get("response_mode", "full")

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
                # Construir mensajes
                messages = [{"role": "system", "content": ELIANA_SYSTEM_PROMPT}]

                for hist_msg in conversation_history:
                    messages.append(hist_msg)

                messages.append({"role": "user", "content": user_message})

                max_tokens = 500 if response_mode == "short" else 1000

                # Stream de respuesta con Groq
                stream = await llm_client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=messages,
                    stream=True,
                    max_tokens=max_tokens,
                    temperature=0.7
                )

                full_response = ""
                token_count = 0
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        token_count += 1
                        await websocket.send_json({
                            "type": "token",
                            "content": token
                        })

                print(f"[WS] Stream terminado — {token_count} tokens")

                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": full_response})

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
        print(f"[WS] Cliente desconectado — historial: {len(conversation_history)} msgs")
    except Exception as e:
        print(f"[WS] Error WebSocket: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=True
    )
