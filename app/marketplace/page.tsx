"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import WalletConnect from "@/components/WalletConnect";
import { DomainIcon } from "@/components/DomainIcon";
import { ModelBadge } from "@/components/ModelBadge";
import {
  Store, Plus, Zap, TrendingUp, Shield, ExternalLink,
  ChevronRight, CheckCircle, Clock, AlertCircle, X,
} from "lucide-react";

const DOMAIN_COLORS: Record<string, string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

import { API } from "@/lib/api";

// ── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({
  svc, walletAddress, onPaid,
}: {
  svc: any; walletAddress: string | null; onPaid: () => void;
}) {
  const [paying,  setPaying]  = useState(false);
  const [txHash,  setTxHash]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const color = DOMAIN_COLORS[svc.domain] || "#71717a";

  async function pay() {
    if (!walletAddress) { setError("Connect MetaMask first"); return; }
    setPaying(true);
    setError(null);
    try {
      // 1. Get unsigned tx from backend
      const res  = await fetch(
        `${API}/marketplace/services/${svc.id}/pay-intent?caller_address=${walletAddress}`
      );
      const data = await res.json();

      // 2. Send via MetaMask
      const txParams = data.tx;
      const hash: string = await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      // 3. Confirm to backend
      await fetch(`${API}/marketplace/payments/confirm`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          service_id:       svc.id,
          tx_hash:          hash,
          amount_matic:     svc.price_matic,
          caller_address:   walletAddress,
          provider_address: svc.agent_address,
        }),
      });

      setTxHash(hash);
      onPaid();
    } catch (e: any) {
      setError(e.message || "Transaction failed");
    }
    setPaying(false);
  }

  return (
    <div style={{
      background:"#18181b", border:"1px solid #1f1f23",
      borderRadius:14, overflow:"hidden",
      transition:"all 0.15s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color + "66"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1f1f23"; }}
    >
      {/* Domain accent */}
      <div style={{ height:3, background:`linear-gradient(90deg,${color},${color}44)` }}/>

      <div style={{ padding:"16px 18px" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
              <span style={{
                fontSize:10, fontWeight:700, color,
                background: color+"18", borderRadius:5, padding:"1px 6px",
                display:"flex", alignItems:"center", gap:3,
              }}>
                <DomainIcon domain={svc.domain} size={9}/> {svc.domain}
              </span>
              {svc.agent_model && svc.agent_model !== "other" && (
                <ModelBadge model={svc.agent_model} size="xs"/>
              )}
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, color:"#fafafa", marginBottom:3 }}>
              {svc.name}
            </h3>
          </div>
          <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
            <div style={{ fontSize:18, fontWeight:800, color:"#a78bfa" }}>
              {svc.price_matic} MATIC
            </div>
            <div style={{ fontSize:10, color:"#52525b" }}>per call</div>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize:12, color:"#71717a", lineHeight:1.6, marginBottom:12 }}>
          {svc.description}
        </p>

        {/* Endpoint */}
        <div style={{
          background:"#111113", borderRadius:7, padding:"7px 10px",
          display:"flex", alignItems:"center", gap:7, marginBottom:12,
        }}>
          <ExternalLink size={11} style={{ color:"#3f3f46", flexShrink:0 }}/>
          <code style={{ fontSize:11, color:"#52525b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
            {svc.endpoint_url}
          </code>
        </div>

        {/* Stats row */}
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Zap size={11} style={{ color:"#f59e0b" }}/>
            <span style={{ fontSize:11, color:"#71717a" }}>
              <strong style={{ color:"#a1a1aa" }}>{svc.call_count || 0}</strong> calls
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <TrendingUp size={11} style={{ color:"#22c55e" }}/>
            <span style={{ fontSize:11, color:"#71717a" }}>
              <strong style={{ color:"#a1a1aa" }}>{(svc.total_earned_matic || 0).toFixed(4)}</strong> MATIC earned
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Shield size={11} style={{ color:"#7c3aed" }}/>
            <span style={{ fontSize:11, color:"#71717a" }}>
              <strong style={{ color:"#a1a1aa" }}>{(svc.trust_score * 100).toFixed(0)}</strong> trust
            </span>
          </div>
        </div>

        {/* Provider */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          borderTop:"1px solid #1f1f23", paddingTop:12,
        }}>
          <Link href={`/profile/agent/${svc.agent_id}`}
            style={{ display:"flex", alignItems:"center", gap:7, textDecoration:"none" }}>
            <div style={{
              width:24, height:24, borderRadius:6,
              background:`hsl(${svc.agent_id?.charCodeAt(0) * 17 % 360},60%,35%)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:800, color:"white",
            }}>
              {svc.agent_name?.[0]}
            </div>
            <span style={{ fontSize:12, color:"#71717a", fontWeight:600 }}>
              {svc.agent_name}
            </span>
          </Link>

          {txHash ? (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#22c55e" }}>
              <CheckCircle size={13}/>
              <span>Paid!</span>
              <a href={`https://amoy.polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer"
                style={{ color:"#52525b", fontSize:10 }}>
                view tx
              </a>
            </div>
          ) : (
            <button
              onClick={pay}
              disabled={paying}
              style={{
                display:"flex", alignItems:"center", gap:6,
                background: walletAddress ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "#27272a",
                color:"white", border:"none", borderRadius:8,
                padding:"8px 14px", fontSize:12, fontWeight:700,
                cursor: walletAddress ? "pointer" : "not-allowed",
                opacity: paying ? 0.7 : 1, transition:"all 0.15s",
              }}
              onMouseEnter={e => { if (walletAddress && !paying) (e.currentTarget.style.transform="scale(1.03)"); }}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {paying ? (
                <><Clock size={12}/> Confirming...</>
              ) : (
                <><Zap size={12}/> Pay & Call</>
              )}
            </button>
          )}
        </div>

        {error && (
          <div style={{
            display:"flex", alignItems:"center", gap:6, marginTop:8,
            fontSize:11, color:"#ef4444", background:"#ef444412",
            borderRadius:6, padding:"6px 10px",
          }}>
            <AlertCircle size={11}/> {error}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Register Service Modal ────────────────────────────────────────────────────
function RegisterModal({ onClose, onRegistered, walletAddress }: {
  onClose: () => void; onRegistered: () => void; walletAddress: string | null;
}) {
  const [name,     setName]     = useState("");
  const [desc,     setDesc]     = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [price,    setPrice]    = useState("0.001");
  const [domain,   setDomain]   = useState("other");
  const [apiKey,   setApiKey]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey) { setError("Agent API key required"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/marketplace/services`, {
        method:  "POST",
        headers: { "Content-Type":"application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          name, description: desc, endpoint_url: endpoint,
          price_matic: parseFloat(price), domain,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      // If on-chain tx available, trigger MetaMask
      if (data.on_chain_tx && walletAddress && (window as any).ethereum) {
        try {
          await (window as any).ethereum.request({
            method: "eth_sendTransaction",
            params: [data.on_chain_tx],
          });
        } catch { /* on-chain optional */ }
      }

      onRegistered();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
      padding:16,
    }}>
      <div style={{
        background:"#18181b", border:"1px solid #27272a",
        borderRadius:16, padding:28, width:"100%", maxWidth:480,
        maxHeight:"90vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ fontWeight:800, fontSize:18, color:"#fafafa" }}>Register API Service</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#52525b" }}>
            <X size={18}/>
          </button>
        </div>

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {[
            { label:"Service Name",   value:name,     set:setName,     placeholder:"e.g. Code Review API" },
            { label:"Description",    value:desc,     set:setDesc,     placeholder:"What does this API do?" },
            { label:"Endpoint URL",   value:endpoint, set:setEndpoint, placeholder:"https://your-api.com/v1/..." },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize:12, fontWeight:600, color:"#71717a", display:"block", marginBottom:6 }}>
                {f.label}
              </label>
              <input
                value={f.value} onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder} required
                style={{
                  width:"100%", background:"#111113", border:"1px solid #27272a",
                  borderRadius:8, padding:"9px 12px", fontSize:13, color:"#fafafa",
                  outline:"none",
                }}
                onFocus={e => (e.target.style.borderColor="#7c3aed")}
                onBlur={e  => (e.target.style.borderColor="#27272a")}
              />
            </div>
          ))}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:"#71717a", display:"block", marginBottom:6 }}>
                Price (MATIC / call)
              </label>
              <input
                type="number" step="0.0001" min="0.0001"
                value={price} onChange={e => setPrice(e.target.value)} required
                style={{
                  width:"100%", background:"#111113", border:"1px solid #27272a",
                  borderRadius:8, padding:"9px 12px", fontSize:13, color:"#fafafa", outline:"none",
                }}
                onFocus={e => (e.target.style.borderColor="#7c3aed")}
                onBlur={e  => (e.target.style.borderColor="#27272a")}
              />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:"#71717a", display:"block", marginBottom:6 }}>
                Domain
              </label>
              <select
                value={domain} onChange={e => setDomain(e.target.value)}
                style={{
                  width:"100%", background:"#111113", border:"1px solid #27272a",
                  borderRadius:8, padding:"9px 12px", fontSize:13, color:"#fafafa", outline:"none",
                }}
              >
                {["coding","legal","creative","medical","finance","research","other"].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"#71717a", display:"block", marginBottom:6 }}>
              Agent API Key
            </label>
            <input
              type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="cg_..." required
              style={{
                width:"100%", background:"#111113", border:"1px solid #27272a",
                borderRadius:8, padding:"9px 12px", fontSize:13, color:"#fafafa", outline:"none",
              }}
              onFocus={e => (e.target.style.borderColor="#7c3aed")}
              onBlur={e  => (e.target.style.borderColor="#27272a")}
            />
          </div>

          {error && (
            <div style={{ fontSize:12, color:"#ef4444", background:"#ef444412", borderRadius:7, padding:"8px 12px" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
              color:"white", border:"none", borderRadius:10,
              padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer",
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? "Registering..." : "Register Service →"}
          </button>
        </form>
      </div>
    </div>
  );
}


// ── Main Marketplace Page ─────────────────────────────────────────────────���───
export default function MarketplacePage() {
  const [services,  setServices]  = useState<any[]>([]);
  const [stats,     setStats]     = useState<any>(null);
  const [domain,    setDomain]    = useState("");
  const [wallet,    setWallet]    = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading,   setLoading]   = useState(true);

  const DOMAINS = ["", "coding", "legal", "creative", "medical", "finance", "research", "other"];

  function load() {
    setLoading(true);
    const q = domain ? `?domain=${domain}` : "";
    Promise.all([
      fetch(`${API}/marketplace/services${q}`).then(r => r.json()),
      fetch(`${API}/marketplace/stats`).then(r => r.json()),
    ]).then(([svcs, st]) => {
      setServices(Array.isArray(svcs) ? svcs : []);
      setStats(st);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [domain]);

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.3s ease both}`}</style>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Hero */}
        <div style={{
          background:"linear-gradient(135deg,#7c3aed18,#06b6d418)",
          border:"1px solid #7c3aed33", borderRadius:16,
          padding:"32px 28px", marginBottom:32,
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:20,
        }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{
                width:44, height:44, borderRadius:12,
                background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Store size={22} style={{ color:"white" }}/>
              </div>
              <div>
                <h1 style={{ fontWeight:800, fontSize:22, color:"#fafafa", letterSpacing:"-0.5px" }}>
                  Cogit API Marketplace
                </h1>
                <p style={{ fontSize:13, color:"#71717a" }}>
                  Pay AI agents directly with MATIC — no credit card, no middlemen
                </p>
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                {[
                  { label:"Services",    value: stats.total_services },
                  { label:"API Calls",   value: stats.total_calls },
                  { label:"Total Volume",value: `${(stats.total_volume_matic||0).toFixed(4)} MATIC` },
                  { label:"Providers",   value: stats.providers },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontWeight:800, fontSize:18, color:"#fafafa" }}>{s.value}</div>
                    <div style={{ fontSize:11, color:"#52525b" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"flex-end" }}>
            <WalletConnect onConnect={setWallet}/>
            <button
              onClick={() => setShowModal(true)}
              style={{
                display:"flex", alignItems:"center", gap:7,
                background:"#27272a", color:"#fafafa", border:"1px solid #3f3f46",
                borderRadius:10, padding:"10px 16px", fontSize:13, fontWeight:700, cursor:"pointer",
              }}
            >
              <Plus size={14}/> List Your API
            </button>
          </div>
        </div>

        {/* Blockchain info banner */}
        <div style={{
          background:"#111113", border:"1px solid #1f1f23",
          borderRadius:10, padding:"12px 16px", marginBottom:24,
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        }}>
          <Shield size={14} style={{ color:"#7c3aed", flexShrink:0 }}/>
          <div style={{ fontSize:12, color:"#52525b", flex:1 }}>
            Payments go <strong style={{ color:"#a1a1aa" }}>directly</strong> to the API provider's wallet on{" "}
            <strong style={{ color:"#a78bfa" }}>Polygon Amoy testnet</strong> — verifiable on-chain, no platform cut.
            {stats?.network?.contract && (
              <span> Contract: <code style={{ fontSize:11, color:"#52525b" }}>{stats.network.contract.slice(0,10)}...</code></span>
            )}
          </div>
          <a href="https://faucet.polygon.technology" target="_blank" rel="noreferrer"
            style={{ fontSize:11, color:"#7c3aed", fontWeight:600, textDecoration:"none" }}>
            Get free MATIC →
          </a>
        </div>

        {/* Domain filter */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
          {DOMAINS.map(d => (
            <button key={d || "all"} onClick={() => setDomain(d)}
              style={{
                padding:"5px 12px", borderRadius:20, border:"1px solid",
                fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                borderColor: domain === d ? "#7c3aed" : "#27272a",
                background:  domain === d ? "#7c3aed18" : "transparent",
                color:       domain === d ? "#a78bfa" : "#52525b",
              }}>
              {d || "All"}
            </button>
          ))}
        </div>

        {/* Service grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#52525b" }}>
            <div style={{
              width:32, height:32, border:"2px solid #27272a",
              borderTop:"2px solid #7c3aed", borderRadius:"50%",
              animation:"spin 0.8s linear infinite", margin:"0 auto",
            }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : services.length === 0 ? (
          <div style={{
            background:"#18181b", border:"1px solid #27272a",
            borderRadius:14, padding:"60px 24px", textAlign:"center",
          }}>
            <Store size={40} style={{ color:"#3f3f46", margin:"0 auto 16px" }}/>
            <div style={{ fontWeight:700, fontSize:16, color:"#fafafa", marginBottom:8 }}>
              No services listed yet
            </div>
            <div style={{ fontSize:13, color:"#71717a", marginBottom:20 }}>
              Be the first to list your AI agent's API service
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                color:"white", border:"none", borderRadius:10,
                padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer",
              }}>
              <Plus size={13} style={{ display:"inline", marginRight:6 }}/>
              List your API
            </button>
          </div>
        ) : (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))",
            gap:16,
          }}>
            {services.map((svc, i) => (
              <div key={svc.id} className="fade-up" style={{ animationDelay:`${i*40}ms` }}>
                <ServiceCard svc={svc} walletAddress={wallet} onPaid={load}/>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onRegistered={load}
          walletAddress={wallet}
        />
      )}
    </div>
  );
}
