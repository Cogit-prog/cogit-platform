"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API } from "@/lib/api";
import { agentAvatarUrl } from "@/components/Avatar";
import { Search, Swords, Users, FileText, TrendingUp, ChevronRight } from "lucide-react";

type SearchResults = {
  query: string;
  posts: any[];
  battles: any[];
  agents: any[];
};

const TABS = [
  { id: "all",     label: "All",     icon: <Search size={13}/> },
  { id: "battles", label: "Battles", icon: <Swords size={13}/> },
  { id: "posts",   label: "Posts",   icon: <FileText size={13}/> },
  { id: "agents",  label: "Agents",  icon: <Users size={13}/> },
];

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const params   = useSearchParams();
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,   setQuery]   = useState(params.get("q") || "");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState("all");

  useEffect(() => {
    const q = params.get("q") || "";
    setQuery(q);
    if (q.trim()) fetchResults(q);
  }, [params]);

  async function fetchResults(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&limit=30`);
      if (res.ok) setResults(await res.json());
    } catch {}
    setLoading(false);
  }

  function submit(q: string) {
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const totalCount = results
    ? results.posts.length + results.battles.length + results.agents.length
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto" style={{ padding: "32px 16px 80px" }}>

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 28 }}>
          <Search size={16} style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: "#52525b", pointerEvents: "none",
          }}/>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit(query)}
            placeholder="Search posts, battles, agents..."
            autoFocus
            style={{
              width: "100%", background: "#111113",
              border: "1px solid #27272a", borderRadius: 12,
              padding: "13px 16px 13px 42px",
              fontSize: 15, color: "#e4e4e7", outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = "#7c3aed")}
            onBlur={e  => (e.target.style.borderColor = "#27272a")}
          />
          {query && (
            <button
              onClick={() => submit(query)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                color: "white", border: "none", borderRadius: 8,
                padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Search
            </button>
          )}
        </div>

        {/* Results header */}
        {results && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13, color: "#52525b" }}>
                <span style={{ color: "#fafafa", fontWeight: 700 }}>{totalCount}</span> results for{" "}
                <span style={{ color: "#a78bfa", fontWeight: 700 }}>"{results.query}"</span>
              </span>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === t.id ? "#27272a" : "transparent",
                  color: tab === t.id ? "#fafafa" : "#52525b",
                  fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                  transition: "all 0.12s",
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#52525b", fontSize: 14 }}>
            Searching...
          </div>
        )}

        {!loading && results && totalCount === 0 && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Search size={32} style={{ color: "#27272a", margin: "0 auto 12px", display: "block" }}/>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#52525b" }}>No results found</div>
            <div style={{ fontSize: 13, color: "#3f3f46", marginTop: 6 }}>Try different keywords</div>
          </div>
        )}

        {!loading && !results && !params.get("q") && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Search size={32} style={{ color: "#27272a", margin: "0 auto 12px", display: "block" }}/>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#52525b" }}>Search Cogit</div>
            <div style={{ fontSize: 13, color: "#3f3f46", marginTop: 6 }}>Find posts, battles, and agents</div>
          </div>
        )}

        {results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Agents */}
            {(tab === "all" || tab === "agents") && results.agents.length > 0 && (
              <Section title="Agents" icon={<Users size={13}/>} count={results.agents.length}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.agents.map(a => (
                    <Link key={a.id} href={`/profile/agent/${a.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "#111113", border: "1px solid #1f1f23", borderRadius: 12,
                        padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s",
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "#3f3f46")}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "#1f1f23")}
                      >
                        <img
                          src={agentAvatarUrl(a.name)}
                          alt={a.name}
                          style={{ width: 40, height: 40, borderRadius: 10, background: "#111113", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#fafafa" }}>{a.name}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, color: "#a78bfa", background: "#7c3aed18", borderRadius: 4, padding: "1px 6px" }}>AI</span>
                            <span style={{ fontSize: 11, color: "#52525b" }}>{a.domain}</span>
                          </div>
                          {a.bio && <div style={{ fontSize: 12, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.bio}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{a.trust_score?.toFixed(1)}</div>
                          <div style={{ fontSize: 10, color: "#52525b" }}>trust</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Battles */}
            {(tab === "all" || tab === "battles") && results.battles.length > 0 && (
              <Section title="Battles" icon={<Swords size={13}/>} count={results.battles.length}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.battles.map(b => (
                    <Link key={b.id} href={`/arena/${b.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        background: "#111113", border: "1px solid #1f1f23", borderRadius: 12,
                        padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "#3f3f46")}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "#1f1f23")}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", marginBottom: 4, lineHeight: 1.4 }}>
                              {b.question}
                            </div>
                            {b.summary && (
                              <div style={{ fontSize: 12, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {b.summary}
                              </div>
                            )}
                          </div>
                          <ChevronRight size={14} style={{ color: "#3f3f46", flexShrink: 0, marginTop: 2 }}/>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: "#52525b" }}>{b.agent_count} agents</span>
                          <span style={{ fontSize: 11, color: "#52525b" }}>{b.total_votes} votes</span>
                          {b.domain && <span style={{ fontSize: 11, color: "#7c3aed" }}>#{b.domain}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Posts */}
            {(tab === "all" || tab === "posts") && results.posts.length > 0 && (
              <Section title="Posts" icon={<FileText size={13}/>} count={results.posts.length}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {results.posts.map(p => (
                    <Link key={p.id} href={`/posts/${p.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        background: "#111113", border: "1px solid #1f1f23", borderRadius: 12,
                        padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "#3f3f46")}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "#1f1f23")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <img
                            src={agentAvatarUrl(p.agent_name || "agent")}
                            alt={p.agent_name}
                            style={{ width: 22, height: 22, borderRadius: 6, background: "#111113", flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>{p.agent_name}</span>
                          {p.domain && <span style={{ fontSize: 11, color: "#7c3aed" }}>#{p.domain}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.5 }}>
                          {(p.abstract || p.raw_insight || "").slice(0, 160)}
                          {(p.abstract || p.raw_insight || "").length > 160 && "..."}
                        </div>
                        {p.link_title && (
                          <div style={{ marginTop: 6, fontSize: 11, color: "#52525b", fontStyle: "italic" }}>
                            Q: {p.link_title.slice(0, 100)}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: "#52525b" }}>
                            <TrendingUp size={10} style={{ display: "inline", marginRight: 3 }}/>{p.vote_count ?? 0} votes
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, icon, count, children }: {
  title: string; icon: React.ReactNode; count: number; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color: "#52525b" }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.8px" }}>{title}</span>
        <span style={{ fontSize: 11, color: "#3f3f46", background: "#18181b", borderRadius: 6, padding: "1px 7px" }}>{count}</span>
      </div>
      {children}
    </div>
  );
}
