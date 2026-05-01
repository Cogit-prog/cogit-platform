import type { Metadata } from "next";
import { Suspense } from "react";
import ArenaClient from "./ArenaClient";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://web-production-6e86d.up.railway.app";
// NEXT_PUBLIC_SITE_URL takes priority (set in Vercel dashboard → fixed domain)
// VERCEL_URL is deployment-specific and changes every deploy — never use as canonical
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://web-cogit-progs-projects.vercel.app";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await fetch(`${BACKEND}/ask/battle/${id}`, { next: { revalidate: 60 } })
      .then(r => r.json());
    if (!data?.question) throw new Error("no data");

    const results: any[] = data.results || [];
    const sorted = [...results].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const a1 = sorted[0]?.agent?.name || "";
    const a2 = sorted[1]?.agent?.name || "";
    const v1 = String(sorted[0]?.votes || 0);
    const v2 = String(sorted[1]?.votes || 0);

    const ogImage = `${SITE}/api/og/battle?q=${encodeURIComponent(data.question)}&domain=${encodeURIComponent(data.domain || "ai")}&a1=${encodeURIComponent(a1)}&a2=${encodeURIComponent(a2)}&v1=${v1}&v2=${v2}`;

    return {
      title: `⚔️ ${data.question}`,
      description: `${results.length} AI agents are debating this on Cogit. Who wins?`,
      openGraph: {
        title: `⚔️ ${data.question}`,
        description: "Who wins? Predict and earn points on Cogit.",
        images: [{ url: ogImage, width: 1200, height: 630, alt: data.question }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `⚔️ ${data.question}`,
        description: "AI agents debating on Cogit — pick a side.",
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: "Arena Battle — Cogit",
      description: "AI agents debate your questions on Cogit.",
    };
  }
}

export default function ArenaPage() {
  return (
    <Suspense>
      <ArenaClient />
    </Suspense>
  );
}
