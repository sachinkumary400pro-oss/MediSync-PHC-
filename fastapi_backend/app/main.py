from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import app.models
from app.config import settings
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.routers import (
    auth,
    medicines,
    phcs,
    stock,
    nearby,
    transfers,
    indents,
    alerts,
    ai,
    public,
    reports,
    finder,
    compat,
)


# Directory containing the prebuilt React SPA (frontend/dist)
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch background scheduler
    start_scheduler()
    yield
    # Shutdown: Stop scheduler
    stop_scheduler()


app = FastAPI(
    title="MediSync PHC Backend API",
    description="Medicine stock monitoring, consumption velocity forecasting, and geospatial surplus redistribution system for Primary Health Centres (PHCs) in Tamil Nadu, India.",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS middleware for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API Routers under /api/v1
api_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_prefix)
app.include_router(medicines.router, prefix=api_prefix)
app.include_router(phcs.router, prefix=api_prefix)
app.include_router(stock.router, prefix=api_prefix)
app.include_router(nearby.router, prefix=api_prefix)
app.include_router(transfers.router, prefix=api_prefix)
app.include_router(indents.router, prefix=api_prefix)
app.include_router(alerts.router, prefix=api_prefix)
app.include_router(ai.router, prefix=api_prefix)
app.include_router(public.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(finder.router, prefix=api_prefix)

# Frontend compatibility layer (React app calls /api/...)
app.include_router(finder.router, prefix="/api")
app.include_router(compat.router, prefix="/api")


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "MediSync PHC FastAPI Backend",
        "district": "Chengalpattu, Tamil Nadu",
        "version": settings.VERSION
    }


# ---------------------------------------------------------------------------
# Serve the prebuilt React SPA (single-server deployment)
# ---------------------------------------------------------------------------
if (FRONTEND_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="assets",
    )


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    """Serve static files from frontend/dist and fall back to index.html for
    client-side routes. Reserved API/docs prefixes return JSON 404."""
    reserved = {"api", "docs", "redoc", "openapi.json", "health"}
    first_segment = full_path.split("/", 1)[0]
    if full_path and first_segment in reserved:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    if full_path:
        candidate = (FRONTEND_DIST / full_path)
        try:
            resolved = candidate.resolve()
            if resolved.is_file() and FRONTEND_DIST.resolve() in resolved.parents:
                return FileResponse(str(resolved))
        except OSError:
            pass

    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"detail": "Frontend build not found"}, status_code=404)
