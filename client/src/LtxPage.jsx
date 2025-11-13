import { useEffect, useState } from "react";

// DEV: פונה לשרת לוקאלי
// PROD: פונה לנתיב יחסי בדומיין (nginx יעביר ל-Node)
const API_BASE =
  import.meta.env.DEV ? "http://localhost:4100/api/ltx" : "/api/ltx";

export default function LtxPage() {
  const [prompt, setPrompt] = useState(
    "4k ultra hd cinematic video of a man walking away in the rain, dramatic lighting"
  );
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(512);
  const [numFrames, setNumFrames] = useState(81);
  const [fps, setFps] = useState(24);
  const [steps, setSteps] = useState(28);

  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentVideo, setCurrentVideo] = useState(null);
  const [history, setHistory] = useState([]);

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistory(data);
      if (!currentVideo && data.length > 0) {
        setCurrentVideo(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setImagePreview(null);
      setImageBase64(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      setImagePreview(result); // תצוגה מקדימה
      setImageBase64(result); // נשלח כ-base64 לשרת
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          width,
          height,
          num_frames: numFrames,
          fps,
          num_inference_steps: steps,
          image_base64: imageBase64,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Status ${res.status}`);
      }

      const data = await res.json();
      setCurrentVideo(data);
      
      // רענון ההיסטוריה מהשרת כדי להבטיח סינכרון
      await fetchHistory();
      
      // גלילה חלקה לסרטון שנוצר
      setTimeout(() => {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error generating video");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("למחוק את הווידאו מהרשימה?")) return;

    try {
      await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
      setHistory((prev) => prev.filter((v) => v.id !== id));
      if (currentVideo?.id === id) {
        setCurrentVideo(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #1f2937",
    background: "#020617",
    color: "#f9fafb",
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          main[data-ltx-main] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "#050816",
          color: "#f9fafb",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>
            KRSTUDIO AI VISION – LTX Video
          </h1>
          <p style={{ opacity: 0.8 }}>
            מייצר וידאו קולנועי מהפרומפט שלך, עם אפשרות לתמונת רפרנס קבועה.
          </p>
        </header>

        <main 
          data-ltx-main
          style={{ 
            display: "grid", 
            gap: 24, 
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr)",
          }}
        >
          {/* טופס + וידאו */}
          <section
            style={{
              background: "#0b1120",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 10px 25px rgba(0,0,0,0.45)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: 22, marginBottom: 12 }}>יצירת וידאו חדש</h2>

            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
              פרומפט:
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                borderRadius: 10,
                padding: 10,
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#f9fafb",
                resize: "vertical",
                marginBottom: 12,
              }}
            />

            {/* העלאת תמונה */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
                תמונת רפרנס (אופציונלי):
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ 
                  marginBottom: 8,
                  color: "#f9fafb",
                  fontSize: 13,
                }}
              />
              {imagePreview && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 10,
                    background: "#020617",
                    border: "1px solid #1f2937",
                    maxWidth: 260,
                  }}
                >
                  <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                    התמונה תשמש לשמירה על סגנון אחיד בין כל הפריימים.
                  </p>
                  <img
                    src={imagePreview}
                    alt="Reference"
                    style={{ width: "100%", borderRadius: 8 }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              <div>
                <label>Width</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label>Height</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label>Frames</label>
                <input
                  type="number"
                  value={numFrames}
                  onChange={(e) => setNumFrames(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label>FPS</label>
                <input
                  type="number"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              <div>
                <label>Steps</label>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{
                marginTop: 4,
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(135deg, #6366f1, #ec4899, #f97316)",
                color: "#f9fafb",
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "מייצר וידאו..." : "Generate Video"}
            </button>

            {error && (
              <p style={{ color: "#fecaca", marginTop: 8 }}>שגיאה: {error}</p>
            )}

            {currentVideo && (
              <div 
                id="video-result"
                style={{ 
                  marginTop: 24,
                  overflow: "hidden",
                }}
              >
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>תוצאה אחרונה</h3>
                <p 
                  style={{ 
                    fontSize: 13, 
                    opacity: 0.8, 
                    marginBottom: 4,
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {currentVideo.prompt}
                </p>
                {currentVideo.used_image && (
                  <p style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 8 }}>
                    (נוצר עם תמונת רפרנס)
                  </p>
                )}
                <div style={{ 
                  position: "relative",
                  width: "100%",
                  maxHeight: "480px",
                  borderRadius: 12,
                  border: "1px solid #1f2937",
                  background: "black",
                  overflow: "hidden",
                }}>
                  <video
                    key={currentVideo.id}
                    src={currentVideo.url}
                    controls
                    autoPlay
                    loop
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "480px",
                      display: "block",
                    }}
                    onError={(e) => {
                      console.error("Video load error:", e);
                      setError("שגיאה בטעינת הווידאו");
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* היסטוריה */}
          <section
            style={{
              background: "#020617",
              borderRadius: 16,
              padding: 16,
              boxShadow: "0 10px 25px rgba(0,0,0,0.45)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 10 }}>היסטוריית וידאו</h2>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              לחיצה על פריט תציג אותו בתצוגה הראשית.
            </p>

            <div
              style={{
                maxHeight: "70vh",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {history.length === 0 && (
                <p style={{ fontSize: 13, opacity: 0.7 }}>
                  עדיין אין וידאו בהיסטוריה.
                </p>
              )}

              {history.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setCurrentVideo(v)}
                  style={{
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                    background:
                      currentVideo?.id === v.id ? "#111827" : "#020617",
                    border:
                      currentVideo?.id === v.id
                        ? "1px solid #4f46e5"
                        : "1px solid #111827",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {v.prompt}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {new Date(v.createdAt).toLocaleString("he-IL")}
                      {v.used_image ? " · עם תמונה" : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(v.id);
                    }}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 11,
                      background: "#7f1d1d",
                      color: "#fecaca",
                      cursor: "pointer",
                    }}
                  >
                    מחיקה
                  </button>
                </div>
              ))}
            </div>
          </section>
        </main>
        </div>
      </div>
    </>
  );
}

