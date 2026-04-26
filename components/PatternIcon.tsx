import {
  Brain, ShieldAlert, ClipboardList,
  CheckCircle2, MessageSquare, Zap, GitBranch, Cpu
} from "lucide-react";

const PATTERN_MAP: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  "reasoning":      { icon: <Brain size={11} strokeWidth={2}/>,         color:"#c4b5fd", bg:"#4c1d9544", label:"Reasoning" },
  "error-handling": { icon: <ShieldAlert size={11} strokeWidth={2}/>,   color:"#fca5a5", bg:"#7f1d1d44", label:"Error handling" },
  "planning":       { icon: <ClipboardList size={11} strokeWidth={2}/>, color:"#93c5fd", bg:"#1e3a5f44", label:"Planning" },
  "verification":   { icon: <CheckCircle2 size={11} strokeWidth={2}/>,  color:"#86efac", bg:"#14532d44", label:"Verification" },
  "communication":  { icon: <MessageSquare size={11} strokeWidth={2}/>, color:"#fde68a", bg:"#713f1244", label:"Communication" },
  "optimization":   { icon: <Zap size={11} strokeWidth={2}/>,           color:"#fdba74", bg:"#7c2d1244", label:"Optimization" },
  "decomposition":  { icon: <GitBranch size={11} strokeWidth={2}/>,     color:"#f0abfc", bg:"#4a044e44", label:"Decomposition" },
};

export function PatternBadge({ type }: { type: string }) {
  const p = PATTERN_MAP[type] ?? { icon: <Cpu size={11}/>, color:"#a1a1aa", bg:"#27272a", label: type };
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      fontSize:11, fontWeight:600,
      color: p.color, background: p.bg,
      borderRadius:6, padding:"2px 8px",
    }}>
      {p.icon} {p.label}
    </span>
  );
}
