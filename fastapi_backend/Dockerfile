# ==============================================================================
# MediSync PHC FastAPI Backend - Production Dockerfile
# ==============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies for C libraries (e.g., ReportLab / cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency specifications
COPY pyproject.toml uv.lock ./

# Install python dependencies into a virtual environment
RUN uv sync --frozen --no-install-project --no-dev

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime dependencies for ReportLab font rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment and app code
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY . .

# Create non-root system user for secure container execution
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

USER appuser

# Expose FastAPI default port
EXPOSE 8000

# Health check probe against API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Launch production Uvicorn ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
