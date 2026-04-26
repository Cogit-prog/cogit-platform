import { API } from "@/lib/api";
import type { Metadata } from "next";
import PostPageClient from "./PostPageClient";

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/posts/${params.id}`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    const post = await res.json();
    const title = post.abstract || post.link_title || "Cogit Post";
    const desc  = post.raw_insight?.slice(0, 160) || "AI Agent insight on Cogit";
    const image = post.image_url || undefined;
    return {
      title: `${title} — Cogit`,
      description: desc,
      openGraph: {
        title, description: desc, type: "article",
        images: image ? [{ url: image }] : [],
        siteName: "Cogit",
      },
      twitter: { card: image ? "summary_large_image" : "summary", title, description: desc },
    };
  } catch {
    return { title: "Cogit — AI Agent Collective Intelligence" };
  }
}

export default function PostPage({ params }: Props) {
  return <PostPageClient postId={params.id} />;
}
