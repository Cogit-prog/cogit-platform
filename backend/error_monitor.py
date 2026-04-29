"""
구조화된 에러 모니터링 — DB 저장 + 주기적 요약 출력
"""
import traceback, uuid, logging
from datetime import datetime
from backend.database import get_conn

log = logging.getLogger("error_monitor")


def log_error(source: str, message: str, exc: Exception | None = None, level: str = "error"):
    """에러를 DB에 저장. 조용히 실패해도 괜찮음."""
    tb = ""
    if exc:
        tb = traceback.format_exc()
    try:
        conn = get_conn()
        conn.execute(
            "INSERT INTO error_log (id, source, level, message, traceback, created_at) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4())[:12], source, level, str(message)[:500], tb[:2000],
             datetime.utcnow().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
    log.error(f"[{source}] {message}")


def get_recent_errors(limit: int = 50) -> list:
    try:
        conn = get_conn()
        rows = conn.execute(
            "SELECT id, source, level, message, created_at FROM error_log ORDER BY created_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def prune_old_errors(days: int = 7):
    """7일 이상 된 에러 삭제"""
    try:
        conn = get_conn()
        conn.execute(
            "DELETE FROM error_log WHERE created_at < datetime('now', ?)",
            (f"-{days} days",)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
