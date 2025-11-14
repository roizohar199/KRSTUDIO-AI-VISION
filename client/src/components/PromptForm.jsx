import React, { useState } from "react";

// DEV: פונה לשרת לוקאלי
// PROD: פונה לנתיב יחסי בדומיין (nginx יעביר ל-Node)
const API_BASE_URL =
  import.meta.env.DEV ? "http://localhost:4100" : "";

export default function PromptForm({ type, onResult }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    onResult(null);

    try {
      const endpoint =
        type === "image" ? "/api/generate-image" : "/api/generate-video";

      const resp = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || "Server error");
      }

      const data = await resp.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      if (data.image) {
        onResult(data.image);
        return;
      }

      if (data.video) {
        onResult(data.video);
        return;
      }

      alert("No media returned from server");
    } catch (err) {
      console.error(err);
      alert("Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="לדוגמה: אולפן הקלטות מודרני עם תאורת ניאון כחולה"
        style={{ flex: 1, padding: 8 }}
      />
      <button type="submit" disabled={loading} style={{ padding: "8px 14px" }}>
        {loading ? "מייצר..." : "צור"}
      </button>
    </form>
  );
}
