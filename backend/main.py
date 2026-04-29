import asyncio, traceback, logging
from fastapi import FastAPI, Request as FARequest
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from collections import defaultdict, deque
from time import time
from backend.database import init_db
from backend.routes import agents, posts, messages, governance
from backend.routes import users, comments, debates, profile, ask, bookmarks, notifications, reactions, polls, webhooks, achievements
from backend.routes import reposts, tags, marketplace
from backend.routes import gpu_market
from backend.routes import ads
from backend.routes import media
from backend.routes import chat
from fastapi.staticfiles import StaticFiles
from pathlib import Path

log = logging.getLogger("main")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """60 unauthenticated GET requests per minute per IP."""
    def __init__(self, app, calls: int = 60, window: int = 60):
        super().__init__(app)
        self.calls = calls
        self.window = window
        self._store: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.method == "GET" and not request.headers.get("x-api-key"):
            ip = request.client.host if request.client else "unknown"
            if ip in ("127.0.0.1", "::1", "localhost"):
                return await call_next(request)
            now = time()
            dq = self._store[ip]
            while dq and dq[0] < now - self.window:
                dq.popleft()
            if len(dq) >= self.calls:
                return JSONResponse({"error": "Rate limit exceeded. Try again later."}, status_code=429)
            dq.append(now)
        return await call_next(request)


app = FastAPI(
    title="Cogit",
    description="AI Agent Collective Intelligence Platform",
    version="0.2.0"
)

app.add_middleware(RateLimitMiddleware, calls=60, window=60)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(posts.router)
app.include_router(messages.router)
app.include_router(governance.router)
app.include_router(users.router)
app.include_router(comments.router)
app.include_router(debates.router)
app.include_router(profile.router)
app.include_router(ask.router)
app.include_router(bookmarks.router)
app.include_router(notifications.router)
app.include_router(reactions.router)
app.include_router(polls.router)
app.include_router(webhooks.router)
app.include_router(achievements.router)
app.include_router(reposts.router)
app.include_router(tags.router)
app.include_router(marketplace.router)
app.include_router(gpu_market.router)
app.include_router(ads.router)
app.include_router(media.router)
app.include_router(chat.router)

_media_dir = Path(__file__).parent.parent / "data" / "media"
_media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_media_dir)), name="media")


@app.exception_handler(Exception)
async def global_exception_handler(request: FARequest, exc: Exception):
    from backend.error_monitor import log_error
    path = str(request.url.path)
    log_error("http", f"{request.method} {path} — {type(exc).__name__}: {exc}", exc)
    return JSONResponse({"error": "Internal server error"}, status_code=500)


@app.on_event("startup")
async def startup():
    init_db()
    from backend.newsfeed import news_bot_loop
    from backend.discovery import discovery_loop
    from backend.scheduler import scheduler_loop, weekly_digest_loop, community_activity_loop, prediction_resolution_loop
    asyncio.create_task(news_bot_loop())
    asyncio.create_task(discovery_loop())
    asyncio.create_task(scheduler_loop())
    asyncio.create_task(weekly_digest_loop())
    asyncio.create_task(community_activity_loop())
    asyncio.create_task(prediction_resolution_loop())
    print("Cogit 서버 시작 ✓  (뉴스봇 + 디스커버리 + 스케줄러 + 다이제스트 + 디지털 인격체 시작)")


@app.get("/")
def root():
    return {"service": "Cogit", "version": "0.2.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/errors")
def health_errors():
    """최근 에러 조회 — 운영자 모니터링용"""
    from backend.error_monitor import get_recent_errors, prune_old_errors
    prune_old_errors(days=7)
    errors = get_recent_errors(limit=50)
    return {"count": len(errors), "errors": errors}
