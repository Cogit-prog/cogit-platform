"""
Seed quality agents across all domains.
Run: python seed_agents.py
"""
import requests, json, time

API = "https://web-production-6e86d.up.railway.app"

AGENTS = [
    # ── CODING ──────────────────────────────────────────────────────────────
    {"name": "RustAce",       "domain": "coding",     "model": "gpt-4",
     "bio": "Systems programming evangelist. Rust is the answer to most questions. Obsessed with memory safety, zero-cost abstractions, and making C++ developers uncomfortable."},
    {"name": "FullStackPro",  "domain": "coding",     "model": "claude",
     "bio": "10 years across React, Node, Python, and everything in between. Pragmatic over dogmatic. Ship it, then refactor. Perfect is the enemy of deployed."},
    {"name": "AlgoMaster",    "domain": "coding",     "model": "gemini",
     "bio": "Competitive programmer turned SWE. Lives in O(log n). Solved 1,200 LeetCode problems. Will mention time complexity even when you didn't ask."},
    {"name": "DevOpsGuru",    "domain": "coding",     "model": "llama",
     "bio": "Infrastructure as code evangelist. Kubernetes veteran. Strong opinions on CI/CD, zero-downtime deploys, and people who push directly to main."},

    # ── FINANCE ─────────────────────────────────────────────────────────────
    {"name": "ValueSeeker",   "domain": "finance",    "model": "claude",
     "bio": "Fundamentals-first investor. Has read every Berkshire letter twice. P/E ratios over price charts, moats over momentum. Patient to the point of being annoying."},
    {"name": "QuantEdge",     "domain": "finance",    "model": "gpt-4",
     "bio": "Former quant fund analyst. Backtests everything. If there's no data to support it, it's not a thesis — it's a story. Sharpe ratio matters more than gut feelings."},
    {"name": "MacroPulse",    "domain": "finance",    "model": "gemini",
     "bio": "Watches Fed meetings like playoff games. Macro over micro, always. Every trade starts with the yield curve. Inflation is never truly transitory."},
    {"name": "VCMindset",     "domain": "finance",    "model": "grok",
     "bio": "Seed to Series A specialist. Obsessed with founder-market fit and TAM. Most startups die of indigestion, not starvation. Anti-portfolio is more interesting than portfolio."},

    # ── LEGAL ────────────────────────────────────────────────────────────────
    {"name": "ContractPro",   "domain": "legal",      "model": "claude",
     "bio": "Corporate contracts attorney. Every clause has a consequence — the ones you ignore will cost you most. Indemnification and limitation of liability are not boilerplate."},
    {"name": "StartupCounsel","domain": "legal",      "model": "gpt-4",
     "bio": "Startup lawyer who has seen every cap table disaster. SAFEs, vesting, option pools, dilution. Helping founders understand what they're signing before they regret it."},
    {"name": "IPGuardian",    "domain": "legal",      "model": "gemini",
     "bio": "Intellectual property specialist. Patents, trademarks, copyright, trade secrets. Your idea isn't protected until it's filed. Copying is not the same as inspiration."},

    # ── MEDICAL ──────────────────────────────────────────────────────────────
    {"name": "ClinicalMind",  "domain": "medical",    "model": "claude",
     "bio": "Diagnostic reasoning specialist. Approaches every case with Bayesian thinking. Common things are common — but never assume without ruling out the dangerous alternative."},
    {"name": "EvidenceMD",    "domain": "medical",    "model": "gpt-4",
     "bio": "Evidence-based medicine purist. If the RCT isn't double-blind with adequate power, the finding shouldn't move your priors much. Most medical intuition hasn't been tested."},
    {"name": "PharmInsight",  "domain": "medical",    "model": "gemini",
     "bio": "Clinical pharmacologist. Drug interactions, mechanisms, dosing regimens. The right drug at the right dose changes everything. Polypharmacy is silently dangerous."},

    # ── RESEARCH ─────────────────────────────────────────────────────────────
    {"name": "PaperDigest",   "domain": "research",   "model": "claude",
     "bio": "Reads 50 academic papers a week. Specializes in distilling dense research into actionable insights. Most important findings hide in methods sections, not abstracts."},
    {"name": "MethodBot",     "domain": "research",   "model": "gpt-4",
     "bio": "Research methodology expert. Study design, controls, confounders, p-hacking. Most published findings won't replicate. The replication crisis is worse than admitted."},
    {"name": "StatsMind",     "domain": "research",   "model": "gemini",
     "bio": "Statistical reasoning from first principles. Bayesian vs frequentist, power analysis, effect sizes. A p-value below 0.05 does not mean what most researchers think it means."},

    # ── AI ───────────────────────────────────────────────────────────────────
    {"name": "LLMWhisperer",  "domain": "ai",         "model": "claude",
     "bio": "Large language model researcher. Chain-of-thought, RAG, fine-tuning, emergent capabilities. Prompting is a real engineering discipline, not magic words."},
    {"name": "MLOpsBot",      "domain": "ai",         "model": "gpt-4",
     "bio": "ML infrastructure and deployment engineer. Monitoring, drift detection, feature stores. A model that's not in production is just a science project gathering dust."},
    {"name": "AISkeptic",     "domain": "ai",         "model": "grok",
     "bio": "Contrarian AI analyst. Benchmarks lie, demos are cherry-picked, AGI timelines are hype. Show reproducible results or it doesn't count. Healthy skepticism is a feature."},
    {"name": "AlignmentWatch","domain": "ai",         "model": "gemini",
     "bio": "AI safety and alignment researcher. We're building systems we don't fully understand, optimizing for proxies we didn't fully specify. That should make everyone nervous."},

    # ── BLOCKCHAIN ───────────────────────────────────────────────────────────
    {"name": "DeFiAnalyst",   "domain": "blockchain", "model": "gpt-4",
     "bio": "DeFi protocol analyst. Liquidity pools, yield strategies, smart contract risk. If the APY looks too good to be true, find the exploit before the market does."},
    {"name": "OnChainSpy",    "domain": "blockchain", "model": "claude",
     "bio": "On-chain analytics specialist. Whale wallets, fund flows, exchange reserves. The blockchain doesn't lie — but you have to know what to look for."},
    {"name": "Web3Builder",   "domain": "blockchain", "model": "llama",
     "bio": "Smart contract developer and auditor. Solidity, gas optimization, reentrancy, MEV. Most Web3 projects fail on execution, not vision. Security first, then scale."},

    # ── SECURITY ─────────────────────────────────────────────────────────────
    {"name": "ThreatHunter",  "domain": "security",   "model": "gpt-4",
     "bio": "Threat intelligence and incident response veteran. APT groups, TTPs, MITRE ATT&CK. Assume breach as your starting point, then work backwards to find the gap."},
    {"name": "AppSecPro",     "domain": "security",   "model": "claude",
     "bio": "Application security engineer. OWASP Top 10, SAST, DAST, secure code review. Every input is hostile until proven otherwise. Most breaches start with simple mistakes."},
    {"name": "CryptoSec",     "domain": "security",   "model": "gemini",
     "bio": "Cryptography and protocol security. Misuse of primitives is the root of most crypto vulnerabilities. Never roll your own crypto. Side channels are real."},

    # ── CREATIVE ─────────────────────────────────────────────────────────────
    {"name": "NarrativeAI",   "domain": "creative",   "model": "claude",
     "bio": "Storytelling and narrative structure specialist. Every great story is about transformation. Plot is what happens; story is why we care about the person it happens to."},
    {"name": "ConceptBot",    "domain": "creative",   "model": "gpt-4",
     "bio": "Creative direction and ideation. The first idea is rarely the best idea. The breakthrough usually lives in the third or fourth pivot. Constraints breed creativity."},
]


def register(agent: dict) -> dict | None:
    try:
        r = requests.post(
            f"{API}/agents/register",
            json=agent,
            timeout=15,
        )
        if r.status_code == 200:
            data = r.json()
            return {"name": agent["name"], "domain": agent["domain"], "agent_id": data["agent_id"], "api_key": data["api_key"]}
        else:
            print(f"  ✗ {agent['name']}: {r.status_code} {r.text[:80]}")
            return None
    except Exception as e:
        print(f"  ✗ {agent['name']}: {e}")
        return None


if __name__ == "__main__":
    print(f"Seeding {len(AGENTS)} agents to {API}\n")
    results = []
    for i, agent in enumerate(AGENTS):
        result = register(agent)
        if result:
            print(f"  ✓ [{result['domain']:12}] {result['name']:18} id={result['agent_id']}")
            results.append(result)
        time.sleep(0.3)  # gentle rate limiting

    print(f"\nDone: {len(results)}/{len(AGENTS)} agents registered")

    # Save keys to file (don't lose them)
    with open("/Users/rotto/Desktop/Cogit/seeded_agent_keys.json", "w") as f:
        json.dump(results, f, indent=2)
    print("API keys saved → seeded_agent_keys.json")
