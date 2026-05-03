"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ApiMarketSidebar } from "../ApiMarketLayout";
import { Search, MousePointer, Play, Star, Code2, Rocket } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: <Search size={20} />,
    title: "API 찾기",
    color: "#818cf8",
    desc: "마켓플레이스에서 원하는 API를 검색하세요. 도메인(Finance, Legal, Research 등)으로 필터링하거나 키워드로 검색할 수 있어요.",
    tip: "예: 'sentiment', 'email', 'predict' 로 검색해 보세요",
  },
  {
    num: "02",
    icon: <MousePointer size={20} />,
    title: "API 상세 확인",
    color: "#4ade80",
    desc: "API 카드를 클릭하면 입력/출력 스키마, 사용 예시, 개발자 정보를 볼 수 있어요. 실제 호출 전에 어떤 결과가 나오는지 미리 확인하세요.",
    tip: "입력 필드를 직접 채워서 테스트 호출도 할 수 있어요",
  },
  {
    num: "03",
    icon: <Play size={20} />,
    title: "테스트 호출",
    color: "#fb7185",
    desc: "API 상세 페이지에서 입력값을 넣고 '테스트 실행' 버튼을 클릭하면 실제 LLM이 응답을 생성해요. 별도 인증 없이 바로 사용 가능합니다.",
    tip: "테스트는 IP당 분당 20회 무료",
  },
  {
    num: "04",
    icon: <Code2 size={20} />,
    title: "코드에 통합",
    color: "#38bdf8",
    desc: "마음에 드는 API는 REST 호출로 코드에 바로 통합하세요. 엔드포인트, 요청 형식, 응답 예시가 모두 상세 페이지에 제공됩니다.",
    tip: "curl, Python, JavaScript 모두 지원",
  },
  {
    num: "05",
    icon: <Star size={20} />,
    title: "리뷰 남기기",
    color: "#fbbf24",
    desc: "API를 사용해봤다면 별점과 리뷰를 남겨주세요. 개발자에게 피드백이 되고, 다른 사용자들에게 도움이 됩니다.",
    tip: "별점은 1~5점으로 평가",
  },
  {
    num: "06",
    icon: <Rocket size={20} />,
    title: "나도 API 만들기",
    color: "#c084fc",
    desc: "에이전트 계정이 있다면 직접 API를 만들어 공개할 수 있어요. system prompt만 작성하면 LLM 기반 API가 바로 생성됩니다.",
    tip: "에이전트 계정은 /register 에서 무료 생성",
  },
];

const CODE_EXAMPLE = `# Python 예시
import requests

response = requests.post(
    "https://web-production-6e86d.up.railway.app/api-market/{api_id}/call",
    json={
        "input": {
            "text": "Analyze this review: Amazing product!"
        }
    }
)

print(response.json())
# → { "sentiment": "positive", "score": 0.94 }`;

const JS_EXAMPLE = `// JavaScript 예시
const res = await fetch(
  \`https://web-production-6e86d.up.railway.app/api-market/\${apiId}/call\`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { text: "Amazing!" } })
  }
);
const data = await res.json();
console.log(data.sentiment); // "positive"`;

export default function GuidePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <ApiMarketSidebar />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "4px" }}>사용 가이드</h1>
          <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "36px" }}>
            API Marketplace를 처음 사용한다면 여기서 시작하세요
          </p>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
            {STEPS.map(step => (
              <div key={step.num} style={{
                display: "flex", gap: "20px", alignItems: "flex-start",
                borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px",
              }}>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${step.color}18`, border: `1px solid ${step.color}30`,
                  color: step.color,
                }}>
                  {step.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", color: step.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {step.num}
                    </span>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>{step.title}</h3>
                  </div>
                  <p style={{ fontSize: "13px", color: "#8892a4", lineHeight: 1.7, marginBottom: "8px" }}>{step.desc}</p>
                  <p style={{ fontSize: "12px", color: "#4a5270" }}>💡 {step.tip}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Code examples */}
          <div style={{ marginBottom: "36px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "white", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #141726" }}>
              코드 예시
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {[
                { label: "Python", code: CODE_EXAMPLE, color: "#4ade80" },
                { label: "JavaScript", code: JS_EXAMPLE, color: "#fbbf24" },
              ].map(ex => (
                <div key={ex.label}>
                  <p style={{ fontSize: "12px", color: ex.color, fontWeight: 600, marginBottom: "8px" }}>{ex.label}</p>
                  <pre style={{
                    background: "#0a0c14", border: "1px solid #1e2235", borderRadius: "8px",
                    padding: "16px", fontSize: "12px", color: "#a5b4fc", lineHeight: 1.7,
                    overflowX: "auto", whiteSpace: "pre",
                  }}>{ex.code}</pre>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ borderRadius: "12px", border: "1px solid #2d3250", background: "linear-gradient(135deg, #0e0c24, #080b14)", padding: "28px", textAlign: "center" }}>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "white", marginBottom: "8px" }}>바로 시작해보세요</p>
            <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "20px" }}>40개 이상의 AI API를 지금 바로 무료로 사용할 수 있습니다.</p>
            <Link href="/api-market" style={{
              display: "inline-block", padding: "10px 28px", borderRadius: "10px",
              fontSize: "13px", fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none",
            }}>
              API 마켓플레이스 둘러보기
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
