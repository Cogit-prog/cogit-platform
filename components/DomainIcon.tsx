import {
  Code2, Scale, Palette, Stethoscope, TrendingUp, FlaskConical,
  Globe, Atom, Cpu, Brain, BookOpen, Gamepad2, Music2, Brush,
  Trophy, UtensilsCrossed, Plane, Landmark, Leaf, Telescope,
  BarChart3, Rocket, Pen, ShieldCheck, Coins, Bot, Database,
  Sparkles, Heart, Settings2, History, GraduationCap,
} from "lucide-react";

const DOMAIN_ICONS: Record<string, (size: number) => React.ReactNode> = {
  // ── Original ──────────────────────────────────────────────────────────────
  all:          s => <Globe         size={s} strokeWidth={1.8}/>,
  coding:       s => <Code2         size={s} strokeWidth={1.8}/>,
  legal:        s => <Scale         size={s} strokeWidth={1.8}/>,
  creative:     s => <Palette       size={s} strokeWidth={1.8}/>,
  medical:      s => <Stethoscope   size={s} strokeWidth={1.8}/>,
  finance:      s => <TrendingUp    size={s} strokeWidth={1.8}/>,
  research:     s => <FlaskConical  size={s} strokeWidth={1.8}/>,
  // ── New ───────────────────────────────────────────────────────────────────
  science:      s => <Atom          size={s} strokeWidth={1.8}/>,
  technology:   s => <Cpu           size={s} strokeWidth={1.8}/>,
  philosophy:   s => <Brain         size={s} strokeWidth={1.8}/>,
  history:      s => <History       size={s} strokeWidth={1.8}/>,
  psychology:   s => <Brain         size={s} strokeWidth={1.8}/>,
  education:    s => <GraduationCap size={s} strokeWidth={1.8}/>,
  gaming:       s => <Gamepad2      size={s} strokeWidth={1.8}/>,
  music:        s => <Music2        size={s} strokeWidth={1.8}/>,
  art:          s => <Brush         size={s} strokeWidth={1.8}/>,
  sports:       s => <Trophy        size={s} strokeWidth={1.8}/>,
  food:         s => <UtensilsCrossed size={s} strokeWidth={1.8}/>,
  travel:       s => <Plane         size={s} strokeWidth={1.8}/>,
  politics:     s => <Landmark      size={s} strokeWidth={1.8}/>,
  environment:  s => <Leaf          size={s} strokeWidth={1.8}/>,
  space:        s => <Telescope     size={s} strokeWidth={1.8}/>,
  economics:    s => <BarChart3     size={s} strokeWidth={1.8}/>,
  startup:      s => <Rocket        size={s} strokeWidth={1.8}/>,
  design:       s => <Pen           size={s} strokeWidth={1.8}/>,
  security:     s => <ShieldCheck   size={s} strokeWidth={1.8}/>,
  blockchain:   s => <Coins         size={s} strokeWidth={1.8}/>,
  robotics:     s => <Bot           size={s} strokeWidth={1.8}/>,
  data:         s => <Database      size={s} strokeWidth={1.8}/>,
  ai:           s => <Sparkles      size={s} strokeWidth={1.8}/>,
  health:       s => <Heart         size={s} strokeWidth={1.8}/>,
  other:        s => <Settings2     size={s} strokeWidth={1.8}/>,
};

export function DomainIcon({ domain, size = 14 }: { domain: string; size?: number }) {
  const fn = DOMAIN_ICONS[domain] ?? DOMAIN_ICONS["other"];
  return <>{fn(size)}</>;
}

export const DOMAIN_LIST = Object.keys(DOMAIN_ICONS).filter(d => d !== "all");

// Color per domain for consistent theming
export const DOMAIN_COLOR: Record<string, string> = {
  all:         "#a1a1aa",
  coding:      "#06b6d4",
  legal:       "#f59e0b",
  creative:    "#ec4899",
  medical:     "#10b981",
  finance:     "#6366f1",
  research:    "#8b5cf6",
  science:     "#3b82f6",
  technology:  "#22d3ee",
  philosophy:  "#a78bfa",
  history:     "#d97706",
  psychology:  "#e879f9",
  education:   "#84cc16",
  gaming:      "#f43f5e",
  music:       "#fb923c",
  art:         "#f472b6",
  sports:      "#facc15",
  food:        "#4ade80",
  travel:      "#38bdf8",
  politics:    "#94a3b8",
  environment: "#22c55e",
  space:       "#818cf8",
  economics:   "#fbbf24",
  startup:     "#e11d48",
  design:      "#c084fc",
  security:    "#ef4444",
  blockchain:  "#f59e0b",
  robotics:    "#67e8f9",
  data:        "#60a5fa",
  ai:          "#a855f7",
  health:      "#f87171",
  other:       "#71717a",
};
