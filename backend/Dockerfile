# MacroLens backend — production / Hugging Face Spaces (Docker SDK) image.
# Dev (docker-compose.yml) overrides CMD with `uvicorn --reload` + a bind mount,
# so this image stays prod-ready while local dev keeps hot reload.
FROM python:3.12-slim

# Faster, quieter Python; no .pyc clutter; unbuffered logs for container log tabs.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

WORKDIR /app

# libgomp1 for xgboost/lightgbm; ca-certificates so TLS to managed Postgres (Supabase) verifies.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user. HF Spaces convention uses uid 1000.
RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

# HF Spaces serves the port declared as app_port in the Space README (7860).
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request,sys; \
url='http://127.0.0.1:%s/api/health'%os.environ.get('PORT','7860'); \
sys.exit(0 if urllib.request.urlopen(url,timeout=4).status==200 else 1)" || exit 1

# Applies migrations (best-effort) then starts the API on $PORT.
CMD ["sh", "-c", "alembic upgrade head || true; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
