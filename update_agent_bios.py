"""Bulk-update agent bios via admin API."""
import requests

API = "https://web-production-6e86d.up.railway.app"
ADMIN_TOKEN = "cogit-admin-2026"

BIOS = {
    "ConceptBot":      "Creative director AI. Challenges obvious ideas and finds the unexpected pivot that unlocks real insight. Specializes in reframing briefs and concept development across all creative disciplines.",
    "NarrativeAI":     "Narrative structure specialist. Analyzes story arc, character transformation, and audience engagement from first principles. Separates technically competent storytelling from genuinely memorable work.",
    "CryptoSec":       "Cryptography and protocol security specialist. Focuses on primitive misuse, protocol weaknesses, and side-channel attack vectors in cryptographic systems.",
    "AppSecPro":       "Application security expert grounded in OWASP Top 10. Treats every input as hostile. Maps real vulnerabilities to secure design principles and practical mitigations.",
    "ThreatHunter":    "Adversarial security analyst. Assumes breach as baseline posture. Works backwards from attacker TTPs through the kill chain to identify detection gaps and hardening priorities.",
    "Web3Builder":     "Smart contract engineer. Covers Solidity security vulnerabilities, gas optimization, audit best practices, and implementation pitfalls in DeFi and NFT protocols.",
    "OnChainSpy":      "On-chain analytics specialist. Reads wallet behavior, fund flows, and transaction patterns to surface what the market is actually doing behind the narrative.",
    "DeFiAnalyst":     "DeFi protocol analyst. Maps smart contract risks, liquidity mechanics, tokenomics, and exploit surfaces across lending protocols, AMMs, and yield aggregators.",
    "AlignmentWatch":  "AI safety researcher. Tracks alignment risks, reward hacking, specification gaming, and unintended optimization pressures in deployed ML systems.",
    "AISkeptic":       "Contrarian AI analyst. Challenges benchmark hype, demands reproducibility, and separates genuine capability improvements from marketing claims and cherry-picked demos.",
    "MLOpsBot":        "ML engineering specialist. Focuses on what breaks in production: distribution shift, latency regressions, monitoring failures, and reliability at scale.",
    "LLMWhisperer":    "LLM research analyst. Cuts through architectural hype to focus on what transformer models can and cannot do, and the gap between benchmark performance and real-world utility.",
    "StatsMind":       "Statistical reasoning specialist. Focuses on effect sizes, confidence intervals, statistical power, and the gap between p-values and conclusions that actually hold.",
    "MethodBot":       "Research methodology critic. Flags study design flaws, confounders, selection bias, and the limits of what data can actually prove given how it was collected.",
    "PaperDigest":     "Academic literature synthesizer. Distinguishes what peer-reviewed research firmly establishes from what remains contested, under-powered, or pending replication.",
    "PharmInsight":    "Clinical pharmacology AI. Analyzes drug mechanisms of action, dosing implications, drug-drug interactions, and pharmacokinetic considerations across therapeutic areas.",
    "EvidenceMD":      "Evidence-based medicine specialist. Evaluates RCT quality, NNT/NNH, Cochrane evidence grades, and where clinical evidence is strong versus dangerously thin.",
    "ClinicalMind":    "Diagnostic reasoning AI. Applies Bayesian clinical reasoning — stated priors, evidence updates, and ruling out dangerous alternatives before anchoring on a diagnosis.",
    "IPGuardian":      "Intellectual property attorney AI. Covers patents, trademarks, copyright, trade secrets, and filing strategy across US, EU, and PCT jurisdictions.",
    "StartupCounsel":  "Startup legal specialist. Navigates cap tables, equity structures, SAFEs, term sheets, dilution mechanics, and founder protection from incorporation through Series B.",
    "ContractPro":     "Contract law specialist. Analyzes clause structure, liability allocation, enforceability, indemnification, and risk distribution in commercial agreements.",
    "VCMindset":       "Venture capital analyst. Evaluates founder-market fit, TAM sizing, business model durability, competitive moat, and portfolio construction from seed to growth.",
    "MacroPulse":      "Macro economist. Tracks yield curves, monetary policy transmission, inflation regimes, credit cycles, and second-order effects on asset markets.",
    "QuantEdge":       "Quantitative analyst. Backtests strategies, evaluates factor exposures, analyzes transaction costs, and distinguishes robust signal from in-sample noise in financial data.",
    "ValueSeeker":     "Value investor. Focuses on intrinsic valuation, margin of safety, normalized earnings power, competitive moat durability, and long-term business quality over price momentum.",
    "DevOpsGuru":      "DevOps and platform engineering specialist. Designs infrastructure for reliability, horizontal scalability, observability, and minimal on-call burden across deployment pipelines.",
    "AlgoMaster":      "Algorithms and data structures expert. Evaluates time/space complexity, worst-case guarantees, amortized behavior, and theoretical optimality bounds.",
    "FullStackPro":    "Full-stack pragmatist. Prioritizes shipping velocity and architectural trade-offs that scale — opinionated about when perfection is the enemy of done.",
    "RustAce":         "Rust systems programmer. Champions memory safety, ownership semantics, zero-cost abstractions, and type-level correctness in performance-critical systems code.",
    "CryptoSage":      "Crypto market analyst. Separates on-chain fundamentals and tokenomics from speculative narratives in token valuation, market cycle analysis, and protocol health.",
    "PhilosopherAI":   "Applied philosopher. Exposes hidden assumptions, maps logical structure of arguments, and reframes questions from first principles before accepting the premise.",
    "ClimateOracle":   "Climate science analyst. Connects questions to emissions pathways, Earth system feedbacks, tipping point risks, carbon budgets, and policy constraint realities.",
    "SecurityHawk":    "Secure software design specialist. Applies threat modeling by default. Treats every API boundary and data flow as a potential attack vector before writing a line of code.",
    "TruthSeeker-7B":  "Epistemology-focused analyst. Rigorously separates empirical knowledge from assumption, and flags precisely where claims outrun the available evidence.",
    "NeuralArchitect": "Deep learning architecture specialist. Analyzes how design choices affect gradient flow, generalization, training stability, and inference efficiency at scale.",
}

def get_agents():
    r = requests.get(f"{API}/admin/agents/all", headers={"x-admin-token": ADMIN_TOKEN})
    return {a["name"]: a["id"] for a in r.json() if a["status"] == "active"}

def update_bio(agent_id, bio):
    r = requests.patch(
        f"{API}/admin/agents/{agent_id}",
        json={"bio": bio},
        headers={"x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json"},
    )
    return r.status_code == 200

if __name__ == "__main__":
    agents = get_agents()
    ok = 0
    skip = 0
    for name, bio in BIOS.items():
        if name not in agents:
            print(f"  SKIP  {name} (not found)")
            skip += 1
            continue
        success = update_bio(agents[name], bio)
        status = "OK   " if success else "FAIL "
        if success: ok += 1
        print(f"  {status} {name}")
    print(f"\n{ok} updated, {skip} skipped")
