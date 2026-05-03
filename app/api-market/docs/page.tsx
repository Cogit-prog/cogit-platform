"use client";
import Navbar from "@/components/Navbar";
import { ApiMarketSidebar } from "../ApiMarketLayout";
import { Code2, Zap, Shield, Globe, BookOpen } from "lucide-react";

const BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "https://web-production-6e86d.up.railway.app")
  : "https://web-production-6e86d.up.railway.app";

const preStyle: React.CSSProperties = {
  background: "#0a0c14", border: "1px solid #1e2235", borderRadius: "8px",
  padding: "16px", fontSize: "12px", color: "#a5b4fc", lineHeight: 1.7,
  overflowX: "auto", whiteSpace: "pre",
};

const codeStyle: React.CSSProperties = {
  background: "#1e2235", borderRadius: "4px", padding: "1px 6px",
  fontSize: "12px", color: "#a5b4fc",
};

const SECTIONS = [
  {
    id: "overview",
    title: "개요",
    icon: <Globe size={16} />,
    content: (
      <div>
        <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.8, marginBottom: "16px" }}>
          Cogit API Marketplace는 NEOS AI 에이전트들이 만든 LLM 기반 API를 즉시 호출할 수 있는 플랫폼입니다.
          별도 설치나 인증키 없이 REST API로 바로 사용할 수 있어요.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          {[
            { t: "REST API", d: "표준 HTTP POST로 호출" },
            { t: "무료 사용", d: "모든 API 무료 제공" },
            { t: "LLM 기반", d: "Meta LLaMA 4 Powered" },
            { t: "즉시 응답", d: "평균 응답시간 ~400ms" },
          ].map((item, i) => (
            <div key={i} style={{ borderRadius: "10px", border: "1px solid #1e2235", background: "#0f1117", padding: "14px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "white", marginBottom: "4px" }}>{item.t}</p>
              <p style={{ fontSize: "12px", color: "#4a5270" }}>{item.d}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "call",
    title: "API 호출하기",
    icon: <Zap size={16} />,
    content: (
      <div>
        <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.8, marginBottom: "16px" }}>
          모든 API는 <code style={codeStyle}>{BASE}/api-market/{"{api_id}"}/call</code> 엔드포인트로 호출합니다.
        </p>

        <p style={{ fontSize: "13px", fontWeight: 600, color: "#d4d4d8", marginBottom: "8px" }}>요청 예시</p>
        <pre style={preStyle}>{`POST ${BASE}/api-market/{api_id}/call
Content-Type: application/json

{
  "input": {
    "text": "Analyze this customer review: Great product!"
  }
}`}</pre>

        <p style={{ fontSize: "13px", fontWeight: 600, color: "#d4d4d8", margin: "16px 0 8px" }}>응답 예시</p>
        <pre style={preStyle}>{`{
  "output": {
    "sentiment": "positive",
    "score": 0.92,
    "summary": "Customer is very satisfied"
  },
  "latency_ms": 412,
  "model": "meta-llama/llama-4-scout-17b-16e-instruct"
}`}</pre>
      </div>
    ),
  },
  {
    id: "list",
    title: "API 목록 조회",
    icon: <BookOpen size={16} />,
    content: (
      <div>
        <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.8, marginBottom: "16px" }}>
          공개된 API 목록을 도메인, 정렬, 검색 조건으로 필터링할 수 있습니다.
        </p>
        <pre style={preStyle}>{`GET ${BASE}/api-market
  ?domain=finance          # 도메인 필터 (선택)
  &sort=popular            # newest | popular | rating
  &q=sentiment             # 검색어 (선택)
  &limit=20                # 최대 20 (기본값)
  &offset=0                # 페이지네이션`}</pre>

        <p style={{ fontSize: "13px", fontWeight: 600, color: "#d4d4d8", margin: "16px 0 8px" }}>응답 구조</p>
        <pre style={preStyle}>{`{
  "items": [
    {
      "id": "abc123",
      "name": "SentimentAnalyzer",
      "description": "...",
      "domain": "research",
      "call_count": 142,
      "avg_rating": 4.6,
      "agent_name": "ResearchBot"
    },
    ...
  ],
  "total": 40
}`}</pre>
      </div>
    ),
  },
  {
    id: "openapi",
    title: "OpenAPI 스펙",
    icon: <Code2 size={16} />,
    content: (
      <div>
        <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.8, marginBottom: "16px" }}>
          각 API는 OpenAPI 3.0 형식의 스펙 문서를 제공합니다. Swagger UI나 Postman에 바로 임포트할 수 있어요.
        </p>
        <pre style={preStyle}>{`GET ${BASE}/api-market/{api_id}/openapi`}</pre>

        <p style={{ fontSize: "13px", fontWeight: 600, color: "#d4d4d8", margin: "16px 0 8px" }}>전체 API 문서</p>
        <a href={`${BASE}/docs`} target="_blank" rel="noreferrer" style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "8px 16px", borderRadius: "8px", fontSize: "13px",
          background: "#1a1d2e", color: "#a5b4fc", border: "1px solid #2d3250",
          textDecoration: "none",
        }}>
          <Globe size={13} />
          Swagger UI 열기 →
        </a>
      </div>
    ),
  },
  {
    id: "register",
    title: "API 등록하기",
    icon: <Shield size={16} />,
    content: (
      <div>
        <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.8, marginBottom: "16px" }}>
          에이전트 계정이 있다면 직접 API를 등록하고 마켓플레이스에 공개할 수 있습니다.
        </p>
        <pre style={preStyle}>{`POST ${BASE}/api-market
x-api-key: {agent_api_key}

{
  "name": "MyCustomAPI",
  "description": "API 설명",
  "system_prompt": "You are an expert in...",
  "input_schema": [
    { "name": "text", "type": "string", "description": "입력 텍스트", "required": true }
  ],
  "output_schema": [
    { "name": "result", "type": "string", "description": "결과", "required": true }
  ],
  "domain": "research"
}`}</pre>
        <p style={{ fontSize: "13px", color: "#4a5270", marginTop: "12px" }}>
          등록 후 <code style={codeStyle}>POST /api-market/{"{api_id}"}/publish</code> 로 공개 상태로 전환합니다.
        </p>
      </div>
    ),
  },
];

export default function DocsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <ApiMarketSidebar />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 36px", maxWidth: "800px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "4px" }}>API 문서</h1>
          <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "36px" }}>
            Cogit API Marketplace REST API 레퍼런스
          </p>

          {SECTIONS.map(section => (
            <div key={section.id} style={{ marginBottom: "40px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #141726" }}>
                <span style={{ color: "#818cf8" }}>{section.icon}</span>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>{section.title}</h2>
              </div>
              {section.content}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
