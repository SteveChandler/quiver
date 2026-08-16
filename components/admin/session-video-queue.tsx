"use client";
import { useEffect, useState } from "react";
type Video = { id: string; previewUrl: string | null; file_size: number; created_at: string; sessions?: { beach_name?: string | null } };
export function SessionVideoQueue() {
  const [videos, setVideos] = useState<Video[]>([]);
  useEffect(() => { void fetch("/api/admin/session-videos", { cache: "no-store" }).then((r) => r.json()).then((v) => setVideos(v.videos ?? [])); }, []);
  async function moderate(mediaId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Rejection reason") : null;
    if (action === "reject" && !reason) return;
    await fetch("/api/admin/session-videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId, action, reason }) });
    setVideos((current) => current.filter((video) => video.id !== mediaId));
  }
  return <div className="grid gap-4">{videos.map((video) => <article key={video.id} className="rounded border p-4"><p>{video.sessions?.beach_name ?? "Unknown beach"} · {video.file_size} bytes</p>{video.previewUrl && <video controls preload="metadata" src={video.previewUrl} className="mt-2 max-h-80 w-full" />}<div className="mt-3 flex gap-2"><button onClick={() => void moderate(video.id, "approve")} className="rounded bg-green-600 px-3 py-2 text-white focus-ring">Approve</button><button onClick={() => void moderate(video.id, "reject")} className="rounded bg-red-600 px-3 py-2 text-white focus-ring">Reject</button></div></article>)}</div>;
}
