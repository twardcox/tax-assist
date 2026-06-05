"""
UTBIS FastAPI backend.

Run:  uvicorn api.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.db import init_db
from api.migrate import migrate_yaml_if_needed
from api.routes import (
    auth, config, documents, planning, reconciliation,
    reports, scan, scenarios, tax_forms, tax_law, transactions, user_data,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    migrate_yaml_if_needed()
    yield


app = FastAPI(title="UTBIS API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,          prefix="/api")
app.include_router(config.router,        prefix="/api")
app.include_router(scan.router,          prefix="/api")
app.include_router(user_data.router,     prefix="/api")
app.include_router(reports.router,       prefix="/api")
app.include_router(scenarios.router,     prefix="/api")
app.include_router(tax_law.router,       prefix="/api")
app.include_router(documents.router,     prefix="/api")
app.include_router(planning.router,      prefix="/api")
app.include_router(transactions.router,  prefix="/api")
app.include_router(reconciliation.router, prefix="/api")
app.include_router(tax_forms.router,     prefix="/api")

# Serve compiled React build (production)
DIST = Path(__file__).parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="static")
