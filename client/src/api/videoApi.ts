// FILE: client/src/api/videoApi.ts

export type VideoModel = "mochi" | "cogvideo";

export interface GenerateVideoParams {
  prompt: string;
  model: VideoModel;
  seconds?: number;
  fps?: number;
  width?: number;
  height?: number;
}

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export async function generateVideo({
  prompt,
  model,
  seconds = 15,
  fps = 24,
  width = 512,
  height = 512,
}: GenerateVideoParams): Promise<string> {
  const res = await fetch(`${API_BASE}/video/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model,   // "mochi" או "cogvideo"
      seconds,
      fps,
      width,
      height,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (!data.success || !data.video) {
    throw new Error("API returned no video");
  }

  // data.video = "data:video/mp4;base64,...."
  return data.video as string;
}
