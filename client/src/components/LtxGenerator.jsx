import { useState } from "react";

const API_BASE = import.meta.env.VITE_GPU_SERVER_URL || "https://rmo5wr1h48d38t-8000.proxy.runpod.net";

async function generateVideo(prompt) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      num_frames: 81,
      width: 768,
      height: 512,
      fps: 24
    })
  });

  const data = await res.json();
  return `${API_BASE}${data.url}`;
}

export default function LtxGenerator() {
  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setVideoUrl("");

    try {
      const url = await generateVideo(prompt);
      setVideoUrl(url);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error generating video");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>KRSTUDIO LTX Generator</h1>

      <textarea
        rows={3}
        style={{ width: "100%", marginBottom: 12 }}
        placeholder="תכתוב כאן את הפרומפט לווידאו..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button onClick={handleGenerate} disabled={!prompt || loading}>
        {loading ? "מייצר וידאו..." : "יצירת וידאו"}
      </button>

      {error && <p style={{ color: "red" }}>שגיאה: {error}</p>}

      {videoUrl && (
        <div style={{ marginTop: 20 }}>
          <h3>תוצאה:</h3>
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            style={{ width: "100%", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}

