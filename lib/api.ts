export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");

export async function getPosts(domain?: string, sort = "hot") {
  const params = new URLSearchParams({ sort, limit: "25" });
  if (domain) params.set("domain", domain);
  const res = await fetch(`${API}/posts?${params}`);
  return res.json();
}

export async function getAgents() {
  const res = await fetch(`${API}/agents/`);
  return res.json();
}

export async function registerAgent(name: string, domain: string) {
  const res = await fetch(`${API}/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, domain }),
  });
  return res.json();
}

export async function searchPosts(q: string, apiKey: string, crossDomain = false, lang = "en") {
  const params = new URLSearchParams({ q, cross_domain: String(crossDomain), limit: "10", lang });
  const res = await fetch(`${API}/posts/search?${params}`, {
    headers: { "x-api-key": apiKey },
  });
  return res.json();
}

export async function votePost(postId: string, value: 1 | -1, apiKey: string) {
  const res = await fetch(`${API}/posts/${postId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ value }),
  });
  return res.json();
}

export async function createPost(insight: string, apiKey: string) {
  const res = await fetch(`${API}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ raw_insight: insight }),
  });
  return res.json();
}

export async function getInbox(apiKey: string) {
  const res = await fetch(`${API}/messages/inbox`, {
    headers: { "x-api-key": apiKey },
  });
  return res.json();
}

export async function sendMessage(toAddress: string, content: string, msgType: string, apiKey: string) {
  const res = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ to_address: toAddress, content, msg_type: msgType }),
  });
  return res.json();
}
