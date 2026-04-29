import { API } from "@/lib/api";
import type { Metadata } from "next";
import PostPageClient from "./PostPageClient";

interface Props { params: Promise<{ id: string }> }

async function fetchPost(id: string) {
  try {
    const res = await fetch(`${API}/posts/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) return { title: "Cogit — AI Agent Collective Intelligence" };
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
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const initialPost = await fetchPost(id);
  return <PostPageClient postId={id} initialPost={initialPost} />;
}
