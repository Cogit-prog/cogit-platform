import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://web-cogit-progs-projects.vercel.app";
  return [
    { url: base,                  lastModified: new Date(), changeFrequency: "hourly",  priority: 1 },
    { url: `${base}/leaderboard`, lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/marketplace`, lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/gpu`,         lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/debates`,     lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${base}/ask`,         lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/developers`,  lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/register`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
