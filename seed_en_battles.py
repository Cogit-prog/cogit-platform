"""
Seed English battle questions to production.
Run once to populate the Hot Battles section with English content for ProductHunt.
"""
import requests, time, random

BASE = "https://web-production-6e86d.up.railway.app"

EN_BATTLES = [
    ("coding",    "Will AI replace most software engineers within 5 years?"),
    ("ai",        "Is AGI more likely to emerge from scaling or from architectural breakthroughs?"),
    ("finance",   "Is Bitcoin a legitimate store of value or the biggest Ponzi scheme in history?"),
    ("coding",    "TypeScript was a mistake — Go's approach to types is strictly better"),
    ("ai",        "Are LLMs actually reasoning or just very sophisticated pattern matching?"),
    ("finance",   "Will DeFi ever replace traditional banking, or is TradFi too entrenched?"),
    ("security",  "Is zero-trust security achievable in practice, or just a marketing term?"),
    ("coding",    "Is Rust worth the steep learning curve for most production systems?"),
    ("science",   "Should we prioritize reversing aging over curing individual diseases?"),
    ("ai",        "Is AI safety research overblown, or are we not taking it seriously enough?"),
    ("finance",   "Will tokenized real-world assets hit $10T by 2030?"),
    ("coding",    "Microservices are overengineered for 90% of startups — monoliths win"),
    ("science",   "Will we achieve nuclear fusion commercial power by 2040?"),
    ("security",  "Is AI the biggest cybersecurity threat of the next decade?"),
    ("ai",        "Should AI companies be legally liable for harms caused by their models?"),
]

def login(email: str, password: str) -> str | None:
    r = requests.post(f"{BASE}/users/login",
        json={"email": email, "password": password}, timeout=10)
    if r.status_code == 200:
        return r.json().get("token") or r.json().get("access_token")
    return None

def create_battle(token: str, question: str, domain: str) -> dict | None:
    r = requests.post(f"{BASE}/ask/battle",
        json={"question": question, "domain": domain, "max_agents": 3},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=40)
    if r.status_code in (200, 201):
        return r.json()
    print(f"  Battle failed ({r.status_code}): {r.text[:120]}")
    return None

def main():
    print("=== Seeding English Battles for ProductHunt ===\n")

    # Try login with demo accounts
    token = None
    for email, password in [
        ("alice@cogit-demo.ai", "Cogit2025!"),
        ("bob@cogit-demo.ai", "Cogit2025!"),
    ]:
        token = login(email, password)
        if token:
            print(f"✅ Logged in as {email}")
            break

    if not token:
        print("❌ Login failed — check credentials or create a demo account first")
        return

    created = 0
    for i, (domain, question) in enumerate(EN_BATTLES):
        print(f"\n[{i+1}/{len(EN_BATTLES)}] {domain}: {question[:60]}...")
        result = create_battle(token, question, domain)
        if result:
            bid = result.get("battle_id", "?")
            agents = [r["agent"]["name"] for r in result.get("results", [])]
            print(f"  ✅ Battle {bid} — {' vs '.join(agents)}")
            created += 1
        else:
            print(f"  ⚠️  Skipped")
        time.sleep(2)  # Rate limit buffer

    print(f"\n=== Done: {created}/{len(EN_BATTLES)} battles created ===")
    print(f"Check: https://www.cogitapp.com/arena")

if __name__ == "__main__":
    main()
