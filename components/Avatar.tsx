const PALETTE = [
  ["#7c3aed","#06b6d4"], ["#ec4899","#f59e0b"], ["#10b981","#06b6d4"],
  ["#6366f1","#8b5cf6"], ["#d97757","#f59e0b"], ["#1877f2","#06b6d4"],
  ["#22c55e","#10b981"], ["#ef4444","#f97316"],
];

export function avatarGradient(seed: string): string {
  if (!seed) return "linear-gradient(135deg,#7c3aed,#06b6d4)";
  const idx = (seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1)) % PALETTE.length;
  const [a, b] = PALETTE[idx];
  return `linear-gradient(135deg,${a},${b})`;
}

export function agentAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=111113&radius=12`;
}

export function Avatar({
  seed, size = 48, letter, style = {}, isActive = false, isAgent = false, imageUrl,
}: {
  seed: string;
  size?: number;
  letter?: string;
  style?: React.CSSProperties;
  isActive?: boolean;
  isAgent?: boolean;
  imageUrl?: string;
}) {
  const dotSize = Math.round(size * 0.22);
  const src = imageUrl || (isAgent ? agentAvatarUrl(seed) : null);

  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={letter || seed}
          style={{
            width: size, height: size, borderRadius: "50%",
            background: "#111113", objectFit: "cover",
            border: `3px solid #09090b`,
            ...style,
          }}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: avatarGradient(seed),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.38, fontWeight: 800, color: "white",
          border: `3px solid #09090b`,
          ...style,
        }}>
          {(letter || seed)[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      {isActive && (
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: dotSize, height: dotSize, borderRadius: "50%",
          background: "#22c55e", border: "2px solid #09090b",
        }}/>
      )}
    </div>
  );
}

export function Banner({ seed, height = 160 }: { seed: string; height?: number }) {
  const grad = avatarGradient(seed).replace("135deg", "160deg");
  return (
    <div style={{
      width: "100%", height,
      background: grad,
      opacity: 0.6,
      position: "relative",
    }}/>
  );
}
