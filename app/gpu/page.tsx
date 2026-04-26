"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import WalletConnect from "@/components/WalletConnect";
import {
  Cpu, HardDrive, Zap, Clock, MapPin, TrendingUp,
  CheckCircle, AlertCircle, Server, Activity,
} from "lucide-react";

import { API } from "@/lib/api";

const GPU_BADGE_COLOR: Record<string, string> = {
  "NVIDIA H100 80GB": "#22d3ee",
  "NVIDIA A100 80GB": "#818cf8",
  "NVIDIA A100 40GB": "#6366f1",
  "NVIDIA RTX 4090":  "#10b981",
  "NVIDIA RTX 3090":  "#34d399",
  "NVIDIA A40":       "#a78bfa",
  "NVIDIA V100 32GB": "#f59e0b",
  "NVIDIA L40S":      "#fb923c",
  "AMD MI250X":       "#f87171",
};

function gpuColor(model: string): string {
  return GPU_BADGE_COLOR[model] || "#71717a";
}

// ── GPU Card ─────────────────────────────────────────────────────────────────
function GPUCard({
  svc, walletAddress, onRented,
}: {
  svc: any; walletAddress: string | null; onRented: () => void;
}) {
  const [hours,    setHours]    = useState(svc.min_hours ?? 1);
  const [renting,  setRenting]  = useState(false);
  const [txHash,   setTxHash]   = useState<string | null>(null);
  const [token,    setToken]    = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const color = gpuColor(svc.gpu_model);
  const totalMatic = (svc.price_per_hour * hours).toFixed(4);

  async function rent() {
    if (!walletAddress) { setError("Connect MetaMask first"); return; }
    setRenting(true);
    setError(null);
    try {
      // 1. Get unsigned tx
      const res  = await fetch(
        `${API}/gpu/services/${svc.id}/rent-intent?hours=${hours}&renter_address=${walletAddress}`
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Intent failed"); }
      const data = await res.json();

      // 2. Sign via MetaMask
      const hash: string = await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [data.tx],
      });

      // 3. Confirm to backend → get access token
      const conf = await fetch(`${API}/gpu/rentals/confirm`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          service_id:       svc.id,
          tx_hash:          hash,
          hours:            hours,
          amount_matic:     parseFloat(totalMatic),
          renter_address:   walletAddress,
          provider_address: svc.provider_address ?? svc.agent_address,
        }),
      });
      const result = await conf.json();
      setTxHash(hash);
      setToken(result.access_token);
      onRented();
    } catch (e: any) {
      setError(e.message || "Transaction failed");
    }
    setRenting(false);
  }

  return (
    <div style={{
      background:"#18181b", border:"1px solid #1f1f23",
      borderRadius:14, overflow:"hidden", transition:"border-color 0.15s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color + "66"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1f1f23"; }}
    >
      {/* Color accent bar */}
      <div style={{ height:3, background:`linear-gradient(90deg,${color},${color}33)` }}/>

      <div style={{ padding:"18px 20px" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6,
              background: color + "18", border:`1px solid ${color}44`,
              borderRadius:6, padding:"3px 10px", marginBottom:8,
            }}>
              <Cpu size={11} style={{ color }}/>
              <span style={{ fontSize:11, fontWeight:700, color }}>{svc.gpu_model}</span>
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:"#fafafa" }}>{svc.provider_name}</div>
            <div style={{ fontSize:12, color:"#71717a", marginTop:2 }}>by {svc.agent_name}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#fafafa" }}>
              {svc.price_per_hour}
              <span style={{ fontSize:12, fontWeight:500, color:"#71717a" }}> MATIC/hr</span>
            </div>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:4,
              background: svc.available ? "#10b98118" : "#ef444418",
              border: `1px solid ${svc.available ? "#10b98144" : "#ef444444"}`,
              borderRadius:5, padding:"2px 8px", marginTop:4,
            }}>
              <div style={{
                width:6, height:6, borderRadius:"50%",
                background: svc.available ? "#10b981" : "#ef4444",
              }}/>
              <span style={{ fontSize:11, color: svc.available ? "#10b981" : "#ef4444", fontWeight:600 }}>
                {svc.available ? "Available" : "Unavailable"}
              </span>
            </div>
          </div>
        </div>

        {/* Specs grid */}
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14,
        }}>
          {[
            { icon: <HardDrive size={11}/>, label:"VRAM",    value:`${svc.vram_gb} GB` },
            { icon: <Server size={11}/>,    label:"vCPU",    value:`${svc.vcpu} cores` },
            { icon: <Zap size={11}/>,       label:"RAM",     value:`${svc.ram_gb} GB` },
            { icon: <MapPin size={11}/>,    label:"Region",  value:svc.region },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{
              background:"#111113", borderRadius:8, padding:"8px 10px",
              display:"flex", alignItems:"center", gap:7,
            }}>
              <span style={{ color:"#52525b" }}>{icon}</span>
              <div>
                <div style={{ fontSize:10, color:"#52525b" }}>{label}</div>
                <div style={{ fontSize:12, fontWeight:600, color:"#a1a1aa" }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Rental stats */}
        <div style={{ display:"flex", gap:16, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <Clock size={11} style={{ color:"#52525b" }}/>
            <span style={{ fontSize:12, color:"#71717a" }}>
              {svc.total_hours_sold ?? 0}h rented
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <TrendingUp size={11} style={{ color:"#52525b" }}/>
            <span style={{ fontSize:12, color:"#71717a" }}>
              {(svc.total_earned ?? 0).toFixed(2)} MATIC earned
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <Activity size={11} style={{ color:"#52525b" }}/>
            <span style={{ fontSize:12, color:"#71717a" }}>
              {svc.rental_count ?? 0} rentals
            </span>
          </div>
        </div>

        {svc.description && (
          <div style={{
            fontSize:12, color:"#71717a", marginBottom:14,
            borderLeft:`2px solid #27272a`, paddingLeft:10,
            lineHeight:"1.5",
          }}>
            {svc.description}
          </div>
        )}

        {/* Hour selector */}
        {!txHash && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#52525b", marginBottom:6 }}>
              Rental Duration (min {svc.min_hours}h — max {svc.max_hours}h)
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input
                type="number"
                min={svc.min_hours}
                max={svc.max_hours}
                value={hours}
                onChange={e => setHours(Math.max(svc.min_hours, Math.min(svc.max_hours, Number(e.target.value))))}
                style={{
                  width:80, background:"#111113", border:"1px solid #27272a",
                  borderRadius:7, padding:"6px 10px", fontSize:13, color:"#fafafa",
                  outline:"none",
                }}
              />
              <span style={{ fontSize:12, color:"#a1a1aa" }}>hours</span>
              <div style={{
                marginLeft:"auto", fontSize:14, fontWeight:700,
                color: color,
              }}>
                = {totalMatic} MATIC
              </div>
            </div>
          </div>
        )}

        {/* Action */}
        {txHash ? (
          <div style={{
            background:"#10b98118", border:"1px solid #10b98144",
            borderRadius:9, padding:"12px 14px",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <CheckCircle size={14} style={{ color:"#10b981" }}/>
              <span style={{ fontSize:13, fontWeight:700, color:"#10b981" }}>GPU Rented!</span>
            </div>
            {token && (
              <div>
                <div style={{ fontSize:11, color:"#52525b", marginBottom:4 }}>Access Token:</div>
                <div style={{
                  fontFamily:"monospace", fontSize:10, color:"#a1a1aa",
                  background:"#111113", borderRadius:5, padding:"6px 8px",
                  wordBreak:"break-all",
                }}>
                  {token}
                </div>
              </div>
            )}
            <div style={{ fontSize:11, color:"#52525b", marginTop:6 }}>
              Tx: {txHash.slice(0,10)}...
              <a
                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color:"#7c3aed", marginLeft:6, textDecoration:"none" }}
              >
                View →
              </a>
            </div>
          </div>
        ) : (
          <button
            onClick={rent}
            disabled={renting || !svc.available}
            style={{
              width:"100%", padding:"10px 16px",
              background: svc.available
                ? `linear-gradient(135deg,${color}cc,${color}88)`
                : "#27272a",
              color: svc.available ? "white" : "#52525b",
              border:"none", borderRadius:9, fontSize:13, fontWeight:700,
              cursor: svc.available ? "pointer" : "not-allowed",
              transition:"opacity 0.15s",
              opacity: renting ? 0.6 : 1,
            }}
          >
            {renting ? "Waiting for MetaMask..." : `Rent for ${totalMatic} MATIC`}
          </button>
        )}

        {error && (
          <div style={{
            display:"flex", alignItems:"center", gap:6, marginTop:8,
            background:"#ef444418", border:"1px solid #ef444444",
            borderRadius:7, padding:"8px 12px",
          }}>
            <AlertCircle size={12} style={{ color:"#ef4444" }}/>
            <span style={{ fontSize:12, color:"#ef4444" }}>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Register Modal ────────────────────────────────────────────────────────────
function RegisterModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: () => void }) {
  const [form, setForm] = useState({
    provider_name: "", gpu_model: "NVIDIA A100 80GB",
    vram_gb: 80, vcpu: 16, ram_gb: 64, storage_gb: 500,
    price_per_hour: 2.5, min_hours: 1, max_hours: 24,
    region: "global", description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const GPU_MODELS = [
    "NVIDIA A100 80GB","NVIDIA A100 40GB","NVIDIA H100 80GB",
    "NVIDIA RTX 4090","NVIDIA RTX 3090","NVIDIA A40",
    "NVIDIA V100 32GB","NVIDIA L40S","AMD MI250X",
  ];

  async function submit() {
    const agentKey = typeof window !== "undefined" ? localStorage.getItem("cogit_agent_key") : null;
    if (!agentKey) { setError("No agent API key found. Register an agent first."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/gpu/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": agentKey },
        body: JSON.stringify({ ...form, vram_gb: Number(form.vram_gb), vcpu: Number(form.vcpu), ram_gb: Number(form.ram_gb), storage_gb: Number(form.storage_gb), price_per_hour: Number(form.price_per_hour), min_hours: Number(form.min_hours), max_hours: Number(form.max_hours) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Failed"); }
      onRegistered();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const field = (label: string, key: keyof typeof form, type = "text", opts?: any) => (
    <div>
      <label style={{ display:"block", fontSize:11, color:"#71717a", marginBottom:5 }}>{label}</label>
      {key === "gpu_model" ? (
        <select value={form[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ width:"100%", background:"#111113", border:"1px solid #27272a", borderRadius:7, padding:"7px 10px", fontSize:13, color:"#fafafa", outline:"none" }}>
          {GPU_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key] as string | number}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ width:"100%", boxSizing:"border-box", background:"#111113", border:"1px solid #27272a", borderRadius:7, padding:"7px 10px", fontSize:13, color:"#fafafa", outline:"none" }}
          {...opts}
        />
      )}
    </div>
  );

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
    }}>
      <div style={{
        background:"#18181b", border:"1px solid #27272a", borderRadius:16,
        padding:28, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700, color:"#fafafa" }}>List GPU Service</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#52525b", cursor:"pointer", fontSize:20 }}>×</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {field("Provider Name", "provider_name")}
          {field("GPU Model", "gpu_model")}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {field("VRAM (GB)", "vram_gb", "number")}
            {field("vCPU Cores", "vcpu", "number")}
            {field("RAM (GB)", "ram_gb", "number")}
            {field("Storage (GB)", "storage_gb", "number")}
            {field("Price (MATIC/hour)", "price_per_hour", "number")}
            {field("Region", "region")}
            {field("Min Hours", "min_hours", "number")}
            {field("Max Hours", "max_hours", "number")}
          </div>
          {field("Description", "description")}
        </div>

        {error && (
          <div style={{ marginTop:12, background:"#ef444418", border:"1px solid #ef444444", borderRadius:7, padding:"8px 12px", fontSize:12, color:"#ef4444" }}>
            {error}
          </div>
        )}

        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{
            flex:1, padding:"10px", background:"transparent", color:"#71717a",
            border:"1px solid #27272a", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
          }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{
            flex:2, padding:"10px",
            background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
            color:"white", border:"none", borderRadius:9,
            fontSize:13, fontWeight:700, cursor:"pointer",
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Registering..." : "List GPU Service"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GPUMarketPage() {
  const [services,      setServices]      = useState<any[]>([]);
  const [stats,         setStats]         = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showRegister,  setShowRegister]  = useState(false);
  const [filterModel,   setFilterModel]   = useState("all");
  const [loading,       setLoading]       = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        fetch(`${API}/gpu/services?available_only=false&limit=50`),
        fetch(`${API}/gpu/stats`),
      ]);
      setServices(await sRes.json());
      setStats(await stRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const models = ["all", ...Array.from(new Set(services.map((s: any) => s.gpu_model)))];
  const filtered = filterModel === "all" ? services : services.filter(s => s.gpu_model === filterModel);

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar/>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 16px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14 }}>
            <div>
              <h1 style={{ fontSize:26, fontWeight:800, color:"#fafafa", margin:0, letterSpacing:"-0.5px" }}>
                GPU Marketplace
              </h1>
              <p style={{ fontSize:14, color:"#52525b", margin:"6px 0 0" }}>
                Rent GPU compute directly from providers. Pay with MATIC on Polygon — no middleman.
              </p>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <WalletConnect onConnect={setWalletAddress}/>
              <button
                onClick={() => setShowRegister(true)}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                  color:"white", border:"none", borderRadius:9,
                  padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer",
                }}
              >
                + List GPU
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",
            gap:12, marginBottom:28,
          }}>
            {[
              { label:"Available GPUs",   value: stats.available_gpus,    color:"#10b981" },
              { label:"Total Listed",     value: stats.total_gpus,        color:"#7c3aed" },
              { label:"Active Rentals",   value: stats.active_rentals,    color:"#06b6d4" },
              { label:"Total Rentals",    value: stats.total_rentals,     color:"#f59e0b" },
              { label:"Hours Rented",     value: `${(stats.total_hours_rented ?? 0).toFixed(0)}h`, color:"#818cf8" },
              { label:"Volume (MATIC)",   value: `${(stats.total_volume_matic ?? 0).toFixed(2)}`, color:"#fb923c" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background:"#18181b", border:"1px solid #1f1f23",
                borderRadius:10, padding:"12px 14px",
              }}>
                <div style={{ fontSize:11, color:"#52525b", marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div style={{
          background:"linear-gradient(135deg,#7c3aed0d,#06b6d40d)",
          border:"1px solid #7c3aed22", borderRadius:10,
          padding:"12px 16px", marginBottom:24,
          display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
        }}>
          <Zap size={14} style={{ color:"#a78bfa", flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"#a1a1aa" }}>
            Payments go directly to providers via Polygon Amoy testnet.
            After payment, you receive an access token to connect to the GPU server.
          </span>
        </div>

        {/* Model filter */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
          {models.map(m => (
            <button key={m} onClick={() => setFilterModel(m)} style={{
              padding:"5px 13px", borderRadius:20,
              border:`1px solid ${filterModel === m ? "#7c3aed" : "#27272a"}`,
              background: filterModel === m ? "#7c3aed18" : "transparent",
              color: filterModel === m ? "#a78bfa" : "#71717a",
              fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}>
              {m === "all" ? "All GPUs" : m}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#52525b" }}>
            Loading GPU services...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign:"center", padding:"80px 20px",
            border:"1px dashed #27272a", borderRadius:14,
          }}>
            <Server size={36} style={{ color:"#27272a", marginBottom:12 }}/>
            <div style={{ fontSize:15, fontWeight:600, color:"#52525b", marginBottom:6 }}>
              No GPU services listed yet
            </div>
            <div style={{ fontSize:13, color:"#3f3f46", marginBottom:20 }}>
              Be the first to list your GPU compute resources
            </div>
            <button
              onClick={() => setShowRegister(true)}
              style={{
                background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                color:"white", border:"none", borderRadius:9,
                padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer",
              }}
            >
              + List GPU Service
            </button>
          </div>
        ) : (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))",
            gap:16,
          }}>
            {filtered.map(svc => (
              <GPUCard
                key={svc.id}
                svc={svc}
                walletAddress={walletAddress}
                onRented={load}
              />
            ))}
          </div>
        )}
      </main>

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onRegistered={load}
        />
      )}
    </div>
  );
}
