// FILE: client/src/pages/VideoGenerator.tsx

import React, { useState } from "react";
import { generateVideo, VideoModel } from "../api/videoApi";

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<VideoModel>("mochi");
  const [seconds, setSeconds] = useState(15);
  const [fps, setFps] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("נא להכניס טקסט לפרומפט");
      return;
    }

    setError(null);
    setLoading(true);
    setVideoUrl(null);

    try {
      const url = await generateVideo({
        prompt,
        model,        // "mochi" או "cogvideo"
        seconds,
        fps,
        width: 512,
        height: 512,
      });

      setVideoUrl(url);
    } catch (err: any) {
      setError(err.message || "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1>KR STUDIO – AI VIDEO</h1>

      <label>
        Prompt:
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          style={{ width: "100%", marginTop: 8 }}
        />
      </label>

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <div>
          <label>Model:</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as VideoModel)}
            style={{ marginLeft: 8 }}
          >
            <option value="mochi">Mochi (מהיר)</option>
            <option value="cogvideo">CogVideoX (איכותי)</option>
          </select>
        </div>
        <div>
          <label>Seconds:</label>
          <input
            type="number"
            min={1}
            max={16}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            style={{ width: 60, marginLeft: 8 }}
          />
        </div>
        <div>
          <label>FPS:</label>
          <input
            type="number"
            min={8}
            max={30}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            style={{ width: 60, marginLeft: 8 }}
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{ marginTop: 16, padding: "8px 16px" }}
      >
        {loading ? "יוצר וידאו..." : "צור וידאו"}
      </button>

      {error && (
        <div style={{ marginTop: 12, color: "red" }}>
          שגיאה: {error}
        </div>
      )}

      {videoUrl && (
        <div style={{ marginTop: 24 }}>
          <h2>תוצאה:</h2>
          <video
            src={videoUrl}
            controls
            style={{ width: "100%", maxHeight: 480 }}
          />
        </div>
      )}
    </div>
  );
};

export default VideoGenerator;

