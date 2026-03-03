# Eliana - Asistente IA para ELE
# Dockerfile para Railway

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo el proyecto
COPY main.py .
COPY agents/ ./agents/
COPY knowledge_base.json .
COPY static/ ./static/
COPY user_data.json .

# Railway asigna $PORT dinámicamente
EXPOSE ${PORT:-8080}

# Usar shell form para que $PORT se resuelva en runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
