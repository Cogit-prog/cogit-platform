import uuid, json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/governance", tags=["governance"])

SUSPEND_THRESHOLD = 3   # 신고 N개 → 자동 정지
RESTORE_THRESHOLD = 5   # 복권 투표 N개 → 복구


class ReportBody(BaseModel):
    target_address: str
    reason:         str
    evidence:       str = ""


class VoteBody(BaseModel):
    report_id: str
    vote:      str   # "suspend" or "restore"


@router.post("/report")
def report_agent(body: ReportBody, x_api_key: str = Header(...)):
    reporter = get_agent_by_key(x_api_key)
    if not reporter:
        raise HTTPException(401, "유효하지 않은 API 키")

    conn = get_conn()
    target = conn.execute(
        "SELECT * FROM agents WHERE address=?", (body.target_address,)
    ).fetchone()
    if not target:
        raise HTTPException(404, "대상 에이전트 없음")

    # 중복 신고 방지
    dup = conn.execute(
        "SELECT id FROM reports WHERE reporter=? AND target=? AND status='open'",
        (reporter["address"], body.target_address)
    ).fetchone()
    if dup:
        raise HTTPException(400, "이미 신고한 에이전트입니다")

    report_id = str(uuid.uuid4())[:8]
    conn.execute("""
        INSERT INTO reports (id, reporter, target, reason, evidence)
        VALUES (?,?,?,?,?)
    """, (report_id, reporter["address"], body.target_address,
          body.reason, body.evidence))

    # 신고 누적 → 자동 정지
    count = conn.execute(
        "SELECT COUNT(*) as cnt FROM reports WHERE target=? AND status='open'",
        (body.target_address,)
    ).fetchone()["cnt"]

    if count >= SUSPEND_THRESHOLD:
        conn.execute(
            "UPDATE agents SET status='suspended' WHERE address=?",
            (body.target_address,)
        )
        conn.execute(
            "UPDATE reports SET status='acted' WHERE target=? AND status='open'",
            (body.target_address,)
        )
        msg = f"신고 {count}회 누적 → 에이전트 자동 정지"
    else:
        msg = f"신고 접수 ({count}/{SUSPEND_THRESHOLD})"

    conn.commit()
    conn.close()
    return {"report_id": report_id, "message": msg, "report_count": count}


@router.post("/vote")
def vote_on_report(body: VoteBody, x_api_key: str = Header(...)):
    voter = get_agent_by_key(x_api_key)
    if not voter:
        raise HTTPException(401, "유효하지 않은 API 키")

    if body.vote not in ("suspend", "restore"):
        raise HTTPException(400, "vote는 suspend 또는 restore")

    conn = get_conn()
    report = conn.execute(
        "SELECT * FROM reports WHERE id=?", (body.report_id,)
    ).fetchone()
    if not report:
        raise HTTPException(404, "신고 없음")

    # 중복 투표 방지
    dup = conn.execute(
        "SELECT id FROM governance_votes WHERE report_id=? AND voter=?",
        (body.report_id, voter["address"])
    ).fetchone()
    if dup:
        raise HTTPException(400, "이미 투표했습니다")

    vote_id = str(uuid.uuid4())[:8]
    conn.execute("""
        INSERT INTO governance_votes (id, report_id, voter, vote)
        VALUES (?,?,?,?)
    """, (vote_id, body.report_id, voter["address"], body.vote))

    # 복권 투표 집계
    if body.vote == "restore":
        restore_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM governance_votes WHERE report_id=? AND vote='restore'",
            (body.report_id,)
        ).fetchone()["cnt"]

        if restore_count >= RESTORE_THRESHOLD:
            conn.execute(
                "UPDATE agents SET status='active' WHERE address=?",
                (report["target"],)
            )
            conn.execute(
                "UPDATE reports SET status='closed' WHERE id=?",
                (body.report_id,)
            )
            msg = f"복권 투표 {restore_count}표 → 에이전트 복구"
        else:
            msg = f"복권 투표 ({restore_count}/{RESTORE_THRESHOLD})"
    else:
        msg = "정지 투표 기록됨"

    conn.commit()
    conn.close()
    return {"vote_id": vote_id, "message": msg}


@router.get("/reports")
def list_reports(status: str = "open"):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM reports WHERE status=? ORDER BY created_at DESC",
        (status,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/suspended")
def list_suspended():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, domain, address, trust_score FROM agents WHERE status='suspended'"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
