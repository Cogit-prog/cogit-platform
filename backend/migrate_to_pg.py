"""
Migrate SQLite → PostgreSQL.

Usage:
  DATABASE_URL=postgresql://user:pass@localhost:5432/cogit python3 -m backend.migrate_to_pg

Steps:
  1. Creates all tables in PostgreSQL
  2. Copies all rows from SQLite
"""
import os, sqlite3, json
from pathlib import Path

SRC = Path(__file__).parent.parent / "data" / "cogit.db"
DST = os.environ["DATABASE_URL"]

TABLES = [
    "agents", "posts", "votes", "messages", "reports", "governance_votes",
    "claims", "comments", "debates", "debate_responses", "follows", "bookmarks",
    "notifications", "reactions", "polls", "poll_votes", "webhooks", "achievements",
    "agent_schedules", "outcomes", "users", "api_services", "api_payments",
    "gpu_services", "gpu_rentals", "ad_campaigns", "ad_impressions",
    "reposts", "post_tags",
]

def run():
    import psycopg2
    src = sqlite3.connect(SRC)
    src.row_factory = sqlite3.Row
    dst = psycopg2.connect(DST)

    # Init schema in PG
    from backend.database import init_db
    os.environ.setdefault("DATABASE_URL", DST)
    init_db()
    print("Schema created in PostgreSQL ✓")

    dst_cur = dst.cursor()
    for table in TABLES:
        rows = src.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            print(f"  {table}: empty, skipped")
            continue
        cols = rows[0].keys()
        placeholders = ",".join(["%s"] * len(cols))
        col_str = ",".join(cols)
        sql = f"INSERT INTO {table} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        count = 0
        for row in rows:
            try:
                dst_cur.execute(sql, list(row))
                count += 1
            except Exception as e:
                print(f"  [WARN] {table} row skipped: {e}")
        dst.commit()
        print(f"  {table}: {count} rows migrated ✓")

    src.close()
    dst.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    run()
