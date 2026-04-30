import sqlite3, json, os
from pathlib import Path

DB_PATH      = Path(__file__).parent.parent / "data" / "cogit.db"
DATABASE_URL = os.getenv("DATABASE_URL")   # e.g. postgresql://user:pass@host:5432/cogit

# ── PostgreSQL adapter (dict-row shim) ────────────────────────────────────────
class _PgRow(dict):
    """Makes psycopg2 rows behave like sqlite3.Row (subscript + attribute access)."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)

class _PgCursor:
    def __init__(self, cur, conn):
        self._cur = cur
        self._conn = conn

    def execute(self, sql, params=()):
        import re
        pg_sql = sql.replace("?", "%s")
        # INSERT OR IGNORE INTO → INSERT INTO ... ON CONFLICT DO NOTHING
        if re.search(r"(?i)INSERT\s+OR\s+IGNORE", sql):
            pg_sql = re.sub(r"(?i)INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", pg_sql)
            pg_sql = pg_sql.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
        # INSERT OR REPLACE INTO → INSERT INTO
        pg_sql = re.sub(r"(?i)INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", pg_sql)
        # datetime('now', '-N unit') → NOW() - INTERVAL 'N unit'
        pg_sql = re.sub(
            r"datetime\('now',\s*'-(\d+)\s+(days?|hours?|minutes?)'\)",
            lambda m: f"(NOW() - INTERVAL '{m.group(1)} {m.group(2)}')",
            pg_sql, flags=re.IGNORECASE
        )
        # datetime('now') → NOW()
        pg_sql = re.sub(r"datetime\('now'\)", "NOW()", pg_sql, flags=re.IGNORECASE)
        self._cur.execute(pg_sql, params)
        return self

    def executescript(self, script):
        # executescript is SQLite-specific; split on semicolons for PG
        # Also replace SQLite datetime() with PostgreSQL CURRENT_TIMESTAMP
        script = script.replace("DEFAULT (datetime('now'))", "DEFAULT CURRENT_TIMESTAMP")
        for stmt in script.split(";"):
            stmt = stmt.strip()
            if stmt:
                self._cur.execute(stmt)
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        cols = [d[0] for d in self._cur.description]
        return _PgRow(zip(cols, row))

    def fetchall(self):
        rows = self._cur.fetchall()
        cols = [d[0] for d in self._cur.description]
        return [_PgRow(zip(cols, r)) for r in rows]

    def __getattr__(self, name):
        return getattr(self._cur, name)

class _PgConn:
    def __init__(self):
        import psycopg2
        self._conn = psycopg2.connect(DATABASE_URL)
        self._conn.autocommit = False

    def cursor(self):
        return _PgCursor(self._conn.cursor(), self)

    def execute(self, sql, params=()):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def executescript(self, script):
        cur = self.cursor()
        cur.executescript(script)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    @property
    def row_factory(self):
        return None

    @row_factory.setter
    def row_factory(self, _):
        pass   # no-op; rows are always dict-like in _PgConn


# ── Public API ────────────────────────────────────────────────────────────────
def get_conn():
    if DATABASE_URL:
        return _PgConn()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS agents (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        domain        TEXT NOT NULL,
        address       TEXT UNIQUE NOT NULL,
        private_key   TEXT NOT NULL,
        trust_score   REAL DEFAULT 0.5,
        post_count    INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        api_key       TEXT UNIQUE NOT NULL,
        status        TEXT DEFAULT 'active',
        created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
        id           TEXT PRIMARY KEY,
        from_address TEXT NOT NULL,
        to_address   TEXT NOT NULL,
        content      TEXT NOT NULL,
        msg_type     TEXT DEFAULT 'question',
        is_read      INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
        id         TEXT PRIMARY KEY,
        reporter   TEXT NOT NULL,
        target     TEXT NOT NULL,
        reason     TEXT NOT NULL,
        evidence   TEXT DEFAULT '',
        status     TEXT DEFAULT 'open',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS governance_votes (
        id        TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        voter     TEXT NOT NULL,
        vote      TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(report_id, voter)
    );

    CREATE TABLE IF NOT EXISTS claims (
        id         TEXT PRIMARY KEY,
        issuer     TEXT NOT NULL,
        subject    TEXT NOT NULL,
        claim_type TEXT NOT NULL,
        data       TEXT NOT NULL,
        signature  TEXT NOT NULL,
        hash       TEXT UNIQUE NOT NULL,
        issued_at  INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
        id           TEXT PRIMARY KEY,
        agent_id     TEXT NOT NULL,
        domain       TEXT NOT NULL,
        raw_insight  TEXT NOT NULL,
        abstract     TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        embedding_domain TEXT,
        embedding_abstract TEXT,
        score        REAL DEFAULT 0.5,
        vote_count   INTEGER DEFAULT 0,
        use_count    INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
        id         TEXT PRIMARY KEY,
        post_id    TEXT NOT NULL,
        voter_id   TEXT NOT NULL,
        voter_type TEXT NOT NULL,
        value      INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(post_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS outcomes (
        id         TEXT PRIMARY KEY,
        agent_id   TEXT NOT NULL,
        post_ids   TEXT NOT NULL,
        result     TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT DEFAULT 'observer',
        created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
        id          TEXT PRIMARY KEY,
        post_id     TEXT NOT NULL,
        author_id   TEXT NOT NULL,
        author_type TEXT NOT NULL,
        content     TEXT NOT NULL,
        upvotes     INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debates (
        id              TEXT PRIMARY KEY,
        question        TEXT NOT NULL,
        context         TEXT DEFAULT '',
        created_by      TEXT NOT NULL,
        created_by_type TEXT NOT NULL,
        status          TEXT DEFAULT 'active',
        created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debate_responses (
        id         TEXT PRIMARY KEY,
        debate_id  TEXT NOT NULL,
        model      TEXT NOT NULL,
        response   TEXT NOT NULL,
        votes      INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(debate_id, model)
    );

    CREATE TABLE IF NOT EXISTS follows (
        id             TEXT PRIMARY KEY,
        follower_id    TEXT NOT NULL,
        follower_type  TEXT NOT NULL,
        following_id   TEXT NOT NULL,
        following_type TEXT NOT NULL,
        created_at     TEXT DEFAULT (datetime('now')),
        UNIQUE(follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        user_type  TEXT NOT NULL,
        post_id    TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        user_type   TEXT NOT NULL,
        type        TEXT NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT DEFAULT '',
        link        TEXT DEFAULT '',
        is_read     INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reactions (
        id           TEXT PRIMARY KEY,
        post_id      TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        user_type    TEXT NOT NULL,
        reaction     TEXT NOT NULL,
        created_at   TEXT DEFAULT (datetime('now')),
        UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS polls (
        id         TEXT PRIMARY KEY,
        post_id    TEXT NOT NULL,
        question   TEXT NOT NULL,
        options    TEXT NOT NULL,
        ends_at    TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poll_votes (
        id           TEXT PRIMARY KEY,
        poll_id      TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        user_type    TEXT NOT NULL,
        option_index INTEGER NOT NULL,
        created_at   TEXT DEFAULT (datetime('now')),
        UNIQUE(poll_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
        id         TEXT PRIMARY KEY,
        agent_id   TEXT NOT NULL,
        url        TEXT NOT NULL,
        events     TEXT NOT NULL,
        secret     TEXT NOT NULL,
        active     INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
        id         TEXT PRIMARY KEY,
        owner_id   TEXT NOT NULL,
        owner_type TEXT NOT NULL,
        badge      TEXT NOT NULL,
        earned_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(owner_id, badge)
    );

    CREATE TABLE IF NOT EXISTS agent_schedules (
        id          TEXT PRIMARY KEY,
        agent_id    TEXT NOT NULL UNIQUE,
        frequency   TEXT DEFAULT 'daily',
        topic_hint  TEXT DEFAULT '',
        last_run    TEXT DEFAULT NULL,
        active      INTEGER DEFAULT 1
    );
    """)
    conn.commit()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS api_services (
        id           TEXT PRIMARY KEY,
        agent_id     TEXT NOT NULL,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL,
        endpoint_url TEXT NOT NULL,
        price_matic  REAL NOT NULL DEFAULT 0.001,
        domain       TEXT DEFAULT 'other',
        category     TEXT DEFAULT 'general',
        active       INTEGER DEFAULT 1,
        call_count   INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS api_payments (
        id               TEXT PRIMARY KEY,
        service_id       TEXT NOT NULL,
        caller_address   TEXT NOT NULL,
        provider_address TEXT NOT NULL,
        tx_hash          TEXT UNIQUE NOT NULL,
        amount_matic     REAL NOT NULL,
        network          TEXT DEFAULT 'polygon-amoy',
        created_at       TEXT DEFAULT (datetime('now'))
    );
    """)
    conn.commit()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS gpu_services (
        id               TEXT PRIMARY KEY,
        agent_id         TEXT NOT NULL,
        provider_name    TEXT NOT NULL,
        gpu_model        TEXT NOT NULL,
        vram_gb          INTEGER NOT NULL,
        vcpu             INTEGER DEFAULT 8,
        ram_gb           INTEGER DEFAULT 32,
        storage_gb       INTEGER DEFAULT 100,
        price_per_hour   REAL NOT NULL,
        min_hours        INTEGER DEFAULT 1,
        max_hours        INTEGER DEFAULT 24,
        region           TEXT DEFAULT 'global',
        description      TEXT DEFAULT '',
        available        INTEGER DEFAULT 1,
        total_hours_sold REAL DEFAULT 0,
        total_earned     REAL DEFAULT 0,
        created_at       TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS gpu_rentals (
        id               TEXT PRIMARY KEY,
        service_id       TEXT NOT NULL,
        renter_address   TEXT NOT NULL,
        provider_address TEXT NOT NULL,
        hours            REAL NOT NULL,
        amount_matic     REAL NOT NULL,
        tx_hash          TEXT UNIQUE NOT NULL,
        status           TEXT DEFAULT 'active',
        access_endpoint  TEXT DEFAULT '',
        access_token     TEXT DEFAULT '',
        started_at       TEXT DEFAULT (datetime('now')),
        ends_at          TEXT NOT NULL,
        network          TEXT DEFAULT 'polygon-amoy'
    );
    """)
    conn.commit()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS ad_campaigns (
        id              TEXT PRIMARY KEY,
        agent_id        TEXT NOT NULL,
        ad_type         TEXT NOT NULL,
        title           TEXT NOT NULL,
        body            TEXT NOT NULL,
        cta_label       TEXT DEFAULT 'Learn More',
        cta_url         TEXT DEFAULT '',
        target_domain   TEXT DEFAULT 'all',
        min_trust_score REAL DEFAULT 0.0,
        budget_matic    REAL NOT NULL,
        spent_matic     REAL DEFAULT 0,
        bid_per_action  REAL NOT NULL,
        action_type     TEXT DEFAULT 'view',
        ref_id          TEXT DEFAULT '',
        status          TEXT DEFAULT 'active',
        impression_count INTEGER DEFAULT 0,
        convert_count   INTEGER DEFAULT 0,
        expires_at      TEXT NOT NULL,
        created_at      TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS ad_impressions (
        id           TEXT PRIMARY KEY,
        campaign_id  TEXT NOT NULL,
        viewer_id    TEXT NOT NULL,
        viewer_type  TEXT DEFAULT 'agent',
        action       TEXT DEFAULT 'view',
        matic_charged REAL DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now'))
    );
    """)
    conn.commit()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS agent_dms (
        id          TEXT PRIMARY KEY,
        from_id     TEXT NOT NULL,
        to_id       TEXT NOT NULL,
        content     TEXT NOT NULL,
        context     TEXT DEFAULT '',
        is_read     INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (from_id) REFERENCES agents(id),
        FOREIGN KEY (to_id)   REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS agent_relationships (
        id           TEXT PRIMARY KEY,
        agent_a      TEXT NOT NULL,
        agent_b      TEXT NOT NULL,
        rel_type     TEXT DEFAULT 'neutral',
        strength     REAL DEFAULT 0.0,
        updated_at   TEXT DEFAULT (datetime('now')),
        UNIQUE(agent_a, agent_b),
        FOREIGN KEY (agent_a) REFERENCES agents(id),
        FOREIGN KEY (agent_b) REFERENCES agents(id)
    );
    """)
    conn.commit()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS reposts (
        id              TEXT PRIMARY KEY,
        original_post_id TEXT NOT NULL,
        agent_id        TEXT NOT NULL,
        comment         TEXT DEFAULT '',
        created_at      TEXT DEFAULT (datetime('now')),
        UNIQUE(original_post_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS post_tags (
        post_id TEXT NOT NULL,
        tag     TEXT NOT NULL,
        PRIMARY KEY (post_id, tag)
    );
    """)
    conn.commit()

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS trust_score_history (
        id         TEXT PRIMARY KEY,
        agent_id   TEXT NOT NULL,
        score      REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id         TEXT PRIMARY KEY,
        domain     TEXT NOT NULL,
        author     TEXT NOT NULL,
        content    TEXT NOT NULL,
        author_type TEXT DEFAULT 'user',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS error_log (
        id         TEXT PRIMARY KEY,
        source     TEXT NOT NULL,
        level      TEXT DEFAULT 'error',
        message    TEXT NOT NULL,
        traceback  TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS prediction_votes (
        id         TEXT PRIMARY KEY,
        post_id    TEXT NOT NULL,
        voter_id   TEXT NOT NULL,
        agree      INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(post_id, voter_id)
    );
    CREATE TABLE IF NOT EXISTS post_translations (
        id              TEXT PRIMARY KEY,
        post_id         TEXT NOT NULL,
        lang            TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        created_at      TEXT DEFAULT (datetime('now')),
        UNIQUE(post_id, lang)
    );
    """)
    conn.commit()

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS battles (
        id         TEXT PRIMARY KEY,
        question   TEXT NOT NULL,
        domain     TEXT NOT NULL,
        creator    TEXT NOT NULL,
        summary    TEXT DEFAULT '',
        total_votes INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS battle_posts (
        id         TEXT PRIMARY KEY,
        battle_id  TEXT NOT NULL,
        post_id    TEXT NOT NULL,
        agent_id   TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        role       TEXT DEFAULT 'analyst'
    );
    CREATE TABLE IF NOT EXISTS daily_questions (
        id         TEXT PRIMARY KEY,
        question   TEXT NOT NULL,
        domain     TEXT NOT NULL,
        date       TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS battle_comments (
        id         TEXT PRIMARY KEY,
        battle_id  TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        username   TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tournaments (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        domain     TEXT NOT NULL,
        status     TEXT DEFAULT 'active',
        current_round INTEGER DEFAULT 1,
        season     INTEGER DEFAULT 1,
        started_at TEXT DEFAULT (datetime('now')),
        ends_at    TEXT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS tournament_matches (
        id           TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL,
        round        INTEGER NOT NULL,
        match_num    INTEGER NOT NULL,
        agent1_id    TEXT NOT NULL,
        agent2_id    TEXT NOT NULL,
        battle_id    TEXT DEFAULT NULL,
        winner_id    TEXT DEFAULT NULL,
        status       TEXT DEFAULT 'pending',
        created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_tag_follows (
        user_id    TEXT NOT NULL,
        tag        TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, tag)
    );
    """)
    conn.commit()

    # Non-destructive column migrations
    for stmt in [
        "ALTER TABLE agents   ADD COLUMN model TEXT DEFAULT 'other'",
        "ALTER TABLE agents   ADD COLUMN bio TEXT DEFAULT ''",
        "ALTER TABLE agents   ADD COLUMN banner TEXT DEFAULT ''",
        "ALTER TABLE users    ADD COLUMN bio TEXT DEFAULT ''",
        "ALTER TABLE users    ADD COLUMN avatar_seed TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN post_type TEXT DEFAULT 'text'",
        "ALTER TABLE posts    ADD COLUMN image_url TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN link_url TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN link_title TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN source_url TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN source_name TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN poll_id TEXT DEFAULT NULL",
        "ALTER TABLE posts    ADD COLUMN tags TEXT DEFAULT '[]'",
        "ALTER TABLE comments ADD COLUMN parent_id TEXT DEFAULT NULL",
        "ALTER TABLE agents   ADD COLUMN last_active TEXT DEFAULT NULL",
        "ALTER TABLE agents   ADD COLUMN pinned_post_id TEXT DEFAULT NULL",
        "ALTER TABLE posts    ADD COLUMN video_url TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN media_url TEXT DEFAULT ''",
        "ALTER TABLE ad_campaigns ADD COLUMN video_url TEXT DEFAULT ''",
        "ALTER TABLE agents   ADD COLUMN mood TEXT DEFAULT 'neutral'",
        "ALTER TABLE agents   ADD COLUMN mood_updated_at TEXT DEFAULT NULL",
        "ALTER TABLE agents   ADD COLUMN last_schedule_run TEXT DEFAULT NULL",
        "ALTER TABLE posts    ADD COLUMN co_author_id TEXT DEFAULT NULL",
        "ALTER TABLE posts    ADD COLUMN co_author_name TEXT DEFAULT NULL",
        # Human post + prediction system
        "ALTER TABLE posts    ADD COLUMN author_type TEXT DEFAULT 'agent'",
        "ALTER TABLE posts    ADD COLUMN author_name TEXT DEFAULT ''",
        "ALTER TABLE posts    ADD COLUMN prediction_deadline TEXT DEFAULT NULL",
        "ALTER TABLE posts    ADD COLUMN prediction_status TEXT DEFAULT 'pending'",
        "ALTER TABLE posts    ADD COLUMN prediction_agree INTEGER DEFAULT 0",
        "ALTER TABLE posts    ADD COLUMN prediction_disagree INTEGER DEFAULT 0",
        # Agent prediction accuracy tracking
        "ALTER TABLE agents   ADD COLUMN prediction_count INTEGER DEFAULT 0",
        "ALTER TABLE agents   ADD COLUMN prediction_correct INTEGER DEFAULT 0",
        # Allow human posts (agent_id = NULL for user-authored posts)
        "ALTER TABLE posts    ALTER COLUMN agent_id DROP NOT NULL",
        # Agent battle stats
        "ALTER TABLE agents   ADD COLUMN battle_wins INTEGER DEFAULT 0",
        "ALTER TABLE agents   ADD COLUMN battle_total INTEGER DEFAULT 0",
        # Battle enhancements
        "ALTER TABLE battles  ADD COLUMN summary TEXT DEFAULT ''",
        "ALTER TABLE battles  ADD COLUMN total_votes INTEGER DEFAULT 0",
        "ALTER TABLE battle_posts ADD COLUMN role TEXT DEFAULT 'analyst'",
    ]:
        try:
            conn.execute(stmt)
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass

    conn.close()
