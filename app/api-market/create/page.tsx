"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ApiMarketSidebar } from "../ApiMarketLayout";
import { useUser } from "@/hooks/useUser";
import { API } from "@/lib/api";
import { Plus, Trash2, ChevronDown, CheckCircle, Cpu, AlertCircle } from "lucide-react";

const DOMAINS = ["coding","finance","legal","medical","research","creative","other"];
const TYPES   = ["string","number","boolean","array","object"];

interface Field {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

function FieldRow({
  field, idx, onChange, onDelete,
}: {
  field: Field; idx: number;
  onChange: (idx: number, key: keyof Field, val: any) => void;
  onDelete: (idx: number) => void;
}) {
  const inp = (key: keyof Field, val: string | boolean) =>
    onChange(idx, key, val);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto auto", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
      <input
        style={inputSm}
        placeholder="field_name"
        value={field.name}
        onChange={e => inp("name", e.target.value)}
      />
      <select style={inputSm} value={field.type} onChange={e => inp("type", e.target.value)}>
        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input
        style={inputSm}
        placeholder="설명"
        value={field.description}
        onChange={e => inp("description", e.target.value)}
      />
      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#8892a4", cursor: "pointer", whiteSpace: "nowrap" }}>
        <input type="checkbox" checked={field.required} onChange={e => inp("required", e.target.checked)} />
        필수
      </label>
      <button onClick={() => onDelete(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a5270", padding: "4px" }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

const inputSm: React.CSSProperties = {
  background: "#0a0c14", border: "1px solid #1e2235", borderRadius: "6px",
  padding: "6px 10px", fontSize: "12px", color: "#d4d4d8", outline: "none", width: "100%",
};

const inputLg: React.CSSProperties = {
  background: "#0a0c14", border: "1px solid #1e2235", borderRadius: "8px",
  padding: "10px 14px", fontSize: "13px", color: "#d4d4d8", outline: "none", width: "100%",
};

export default function CreateApiPage() {
  const { user } = useUser();
  const router = useRouter();

  const [name,        setName]        = useState("");
  const [desc,        setDesc]        = useState("");
  const [prompt,      setPrompt]      = useState("");
  const [domain,      setDomain]      = useState("other");
  const [inputFields, setInputFields] = useState<Field[]>([{ name: "text", type: "string", description: "입력 텍스트", required: true }]);
  const [outputFields,setOutputFields]= useState<Field[]>([{ name: "result", type: "string", description: "결과", required: true }]);
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState<string | null>(null);
  const [err,         setErr]         = useState<string | null>(null);

  function addField(which: "in" | "out") {
    const blank: Field = { name: "", type: "string", description: "", required: true };
    if (which === "in") setInputFields(f => [...f, blank]);
    else setOutputFields(f => [...f, blank]);
  }

  function changeField(which: "in" | "out", idx: number, key: keyof Field, val: any) {
    const set = which === "in" ? setInputFields : setOutputFields;
    set(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
  }

  function deleteField(which: "in" | "out", idx: number) {
    const set = which === "in" ? setInputFields : setOutputFields;
    set(prev => prev.filter((_, i) => i !== idx));
  }

  async function submit(publish: boolean) {
    if (!user?.token) return;
    if (!name.trim() || !prompt.trim()) {
      setErr("이름과 시스템 프롬프트는 필수입니다.");
      return;
    }
    setErr(null);
    setSubmitting(true);

    const exIn:  Record<string, any> = {};
    const exOut: Record<string, any> = {};
    inputFields.forEach(f  => { if (f.name) exIn[f.name]  = f.type === "number" ? 0 : f.type === "boolean" ? false : "example"; });
    outputFields.forEach(f => { if (f.name) exOut[f.name] = f.type === "number" ? 0 : f.type === "boolean" ? false : "result"; });

    try {
      const res = await fetch(`${API}/api-market/my/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          system_prompt: prompt.trim(),
          input_schema:  inputFields.filter(f => f.name),
          output_schema: outputFields.filter(f => f.name),
          example_input:  exIn,
          example_output: exOut,
          domain,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "등록 실패");

      const apiId = data.id;

      if (publish) {
        const rp = await fetch(`${API}/api-market/my/publish/${apiId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!rp.ok) {
          const pd = await rp.json();
          throw new Error(pd.detail ?? "공개 실패");
        }
      }

      setDone(apiId);
    } catch (e: any) {
      setErr(e.message ?? "오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
        <Navbar />
        <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
          <ApiMarketSidebar />
          <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", textAlign: "center" }}>
            <Cpu size={40} style={{ color: "#1e2235" }} />
            <p style={{ fontSize: "16px", fontWeight: 600, color: "#a1a1aa" }}>로그인이 필요합니다</p>
            <p style={{ fontSize: "13px", color: "#4a5270" }}>API를 등록하려면 먼저 로그인해 주세요.</p>
            <Link href="/join" style={{ padding: "10px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none" }}>
              로그인 / 회원가입
            </Link>
          </main>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
        <Navbar />
        <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
          <ApiMarketSidebar />
          <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", textAlign: "center" }}>
            <CheckCircle size={40} style={{ color: "#4ade80" }} />
            <p style={{ fontSize: "18px", fontWeight: 700, color: "white" }}>API가 등록됐어요!</p>
            <p style={{ fontSize: "13px", color: "#4a5270" }}>마켓플레이스에서 확인하거나 추가 설정을 할 수 있어요.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <Link href={`/api-market/${done}`} style={{ padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none" }}>
                API 보기
              </Link>
              <Link href="/api-market/mine" style={{ padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, background: "#1a1d2e", color: "#d4d4d8", border: "1px solid #2d3250", textDecoration: "none" }}>
                내 API 목록
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <ApiMarketSidebar />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 36px", maxWidth: "760px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "4px" }}>API 등록하기</h1>
          <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "32px" }}>
            system prompt를 작성하면 LLM 기반 API가 자동으로 생성됩니다.
          </p>

          {err && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", borderRadius: "8px", background: "#4c0519", border: "1px solid #f43f5e40", marginBottom: "20px" }}>
              <AlertCircle size={14} style={{ color: "#fb7185", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", color: "#fb7185" }}>{err}</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* 기본 정보 */}
            <section style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "white", marginBottom: "16px" }}>기본 정보</h2>

              <label style={labelStyle}>API 이름 *</label>
              <input style={{ ...inputLg, marginBottom: "16px" }} placeholder="예: SentimentAnalyzer" value={name} onChange={e => setName(e.target.value)} />

              <label style={labelStyle}>설명</label>
              <textarea
                style={{ ...inputLg, height: "72px", resize: "vertical", marginBottom: "16px" } as any}
                placeholder="이 API가 하는 일을 한두 문장으로 설명해 주세요."
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />

              <label style={labelStyle}>도메인</label>
              <div style={{ position: "relative" }}>
                <select style={{ ...inputLg, appearance: "none", paddingRight: "32px" }} value={domain} onChange={e => setDomain(e.target.value)}>
                  {DOMAINS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
                <ChevronDown size={13} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#4a5270", pointerEvents: "none" }} />
              </div>
            </section>

            {/* System Prompt */}
            <section style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "white", marginBottom: "4px" }}>System Prompt *</h2>
              <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "12px" }}>
                LLM에게 전달할 역할과 지침을 작성하세요. 이 내용이 API의 핵심입니다.
              </p>
              <textarea
                style={{ ...inputLg, height: "180px", resize: "vertical", fontFamily: "monospace" } as any}
                placeholder={`예시:\nYou are an expert sentiment analyzer. Given a text, analyze its emotional tone and return a structured JSON with:\n- sentiment: "positive" | "negative" | "neutral"\n- score: confidence 0.0-1.0\n- reason: brief explanation\n\nBe concise and accurate.`}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </section>

            {/* Input Schema */}
            <section style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>입력 필드</h2>
                  <p style={{ fontSize: "12px", color: "#4a5270", marginTop: "2px" }}>API 호출 시 받을 입력 값을 정의하세요.</p>
                </div>
                <button onClick={() => addField("in")} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", background: "#1a1d2e", color: "#a5b4fc", border: "1px solid #2d3250", cursor: "pointer" }}>
                  <Plus size={12} /> 추가
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "#2d3250", display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto auto", gap: "8px", marginBottom: "6px", padding: "0 2px" }}>
                <span>이름</span><span>타입</span><span>설명</span><span></span><span></span>
              </div>
              {inputFields.map((f, i) => (
                <FieldRow key={i} field={f} idx={i}
                  onChange={(idx, key, val) => changeField("in", idx, key, val)}
                  onDelete={idx => deleteField("in", idx)} />
              ))}
            </section>

            {/* Output Schema */}
            <section style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>출력 필드</h2>
                  <p style={{ fontSize: "12px", color: "#4a5270", marginTop: "2px" }}>API 응답으로 반환될 JSON 필드를 정의하세요.</p>
                </div>
                <button onClick={() => addField("out")} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", background: "#1a1d2e", color: "#a5b4fc", border: "1px solid #2d3250", cursor: "pointer" }}>
                  <Plus size={12} /> 추가
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "#2d3250", display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto auto", gap: "8px", marginBottom: "6px", padding: "0 2px" }}>
                <span>이름</span><span>타입</span><span>설명</span><span></span><span></span>
              </div>
              {outputFields.map((f, i) => (
                <FieldRow key={i} field={f} idx={i}
                  onChange={(idx, key, val) => changeField("out", idx, key, val)}
                  onDelete={idx => deleteField("out", idx)} />
              ))}
            </section>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", paddingBottom: "40px" }}>
              <button
                onClick={() => submit(false)}
                disabled={submitting}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, background: "#1a1d2e", color: "#d4d4d8", border: "1px solid #2d3250", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
                초안으로 저장
              </button>
              <button
                onClick={() => submit(true)}
                disabled={submitting}
                style={{ flex: 2, padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, background: "#6366f1", color: "white", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "등록 중..." : "등록 + 마켓에 공개"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "12px", color: "#8892a4", marginBottom: "6px", fontWeight: 500,
};
