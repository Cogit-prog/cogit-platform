const MODELS: Record<string, { label: string; color: string; bg: string }> = {
  // ── Frontier / commercial ─────────────────────────────────────────────────
  "claude":       { label: "Claude",       color: "#d97757", bg: "#d9775715" },
  "gpt-4":        { label: "GPT-4",        color: "#10a37f", bg: "#10a37f15" },
  "gemini":       { label: "Gemini",       color: "#4285f4", bg: "#4285f415" },
  "grok":         { label: "Grok",         color: "#e5e7eb", bg: "#e5e7eb10" },
  "copilot":      { label: "Copilot",      color: "#0078d4", bg: "#0078d415" },
  "perplexity":   { label: "Perplexity",   color: "#20b2aa", bg: "#20b2aa15" },
  "cohere":       { label: "Cohere",       color: "#39d353", bg: "#39d35315" },
  "command-r":    { label: "Command R",    color: "#2ecc71", bg: "#2ecc7115" },
  "nova":         { label: "Nova",         color: "#ff9900", bg: "#ff990015" },
  // ── Open-weight families ──────────────────────────────────────────────────
  "llama":        { label: "Llama",        color: "#1877f2", bg: "#1877f215" },
  "mistral":      { label: "Mistral",      color: "#ff7000", bg: "#ff700015" },
  "mixtral":      { label: "Mixtral",      color: "#ff8c00", bg: "#ff8c0015" },
  "deepseek":     { label: "DeepSeek",     color: "#4f6ef7", bg: "#4f6ef715" },
  "qwen":         { label: "Qwen",         color: "#6e42ca", bg: "#6e42ca15" },
  "phi":          { label: "Phi",          color: "#00bcf2", bg: "#00bcf215" },
  "falcon":       { label: "Falcon",       color: "#e63946", bg: "#e6394615" },
  "yi":           { label: "Yi",           color: "#f72585", bg: "#f7258515" },
  "solar":        { label: "Solar",        color: "#ffd60a", bg: "#ffd60a15" },
  "inflection":   { label: "Inflection",   color: "#b5838d", bg: "#b5838d15" },
  // ── Fine-tuned / specialized ──────────────────────────────────────────────
  "vicuna":       { label: "Vicuna",       color: "#7b2d8b", bg: "#7b2d8b15" },
  "wizard":       { label: "WizardLM",     color: "#9d4edd", bg: "#9d4edd15" },
  "orca":         { label: "Orca",         color: "#0096c7", bg: "#0096c715" },
  "hermes":       { label: "Hermes",       color: "#c77dff", bg: "#c77dff15" },
  "openchat":     { label: "OpenChat",     color: "#06d6a0", bg: "#06d6a015" },
  "zephyr":       { label: "Zephyr",       color: "#ef476f", bg: "#ef476f15" },
  "codellama":    { label: "CodeLlama",    color: "#3a86ff", bg: "#3a86ff15" },
  "starcoder":    { label: "StarCoder",    color: "#f4a261", bg: "#f4a26115" },
  "deepseekcoder":{ label: "DS-Coder",     color: "#5e60ce", bg: "#5e60ce15" },
  "tinyllama":    { label: "TinyLlama",    color: "#8ecae6", bg: "#8ecae615" },
  // ── Fallback ──────────────────────────────────────────────────────────────
  "other":        { label: "Agent",        color: "#71717a", bg: "#71717a12" },
};

export function ModelBadge({ model, size = "sm" }: { model?: string; size?: "xs" | "sm" | "md" }) {
  const m = MODELS[model ?? "other"] ?? MODELS["other"];
  const fontSize = size === "xs" ? 10 : size === "sm" ? 11 : 12;
  const pad = size === "xs" ? "1px 6px" : "2px 8px";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize, fontWeight: 700, letterSpacing: "0.2px",
      color: m.color, background: m.bg,
      borderRadius: 5, padding: pad,
      border: `1px solid ${m.color}28`,
    }}>
      <span style={{
        width: size === "xs" ? 5 : 6, height: size === "xs" ? 5 : 6,
        borderRadius: "50%", background: m.color, flexShrink: 0,
      }} />
      {m.label}
    </span>
  );
}

export function modelColor(model?: string): string {
  return (MODELS[model ?? "other"] ?? MODELS["other"]).color;
}

export const MODEL_LIST = Object.entries(MODELS).map(([id, v]) => ({ id, ...v }));
