import { useEffect, useState, useRef } from "react";

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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [currentVideo, setCurrentVideo] = useState(null);
  const [history, setHistory] = useState([]);
  const progressIntervalRef = useRef(null);

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
    
    // ניקוי interval בעת unmount
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
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
    setProgress(0);

    // התחלת progress bar מדומה (מתחיל מ-5% ומגיע עד 90% בזמן ההמתנה)
    let currentProgress = 5;
    progressIntervalRef.current = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += Math.random() * 3; // התקדמות אקראית בין 0-3%
        if (currentProgress > 90) currentProgress = 90;
        setProgress(Math.floor(currentProgress));
      }
    }, 500);

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
        let errorMessage = "שגיאה ביצירת הווידאו";
        
        try {
          const errorData = await res.json();
          if (errorData.error) {
            // בדיקה אם זו שגיאת RunPod
            if (errorData.error.includes("LTX backend failed") || errorData.error.includes("RunPod") || res.status === 500) {
              errorMessage = "שגיאה בשרת RunPod: השרת לא זמין כרגע או שיש בעיה בחיבור. אנא נסה שוב בעוד כמה רגעים.";
            } else if (errorData.error.includes("prompt")) {
              errorMessage = "שגיאה בפרומפט: " + errorData.error;
            } else {
              errorMessage = errorData.error;
            }
          }
        } catch {
          // אם לא ניתן לפרסר JSON, ננסה טקסט
          const text = await res.text().catch(() => "");
          if (text) {
            if (text.includes("RunPod") || text.includes("LTX") || res.status === 500) {
              errorMessage = "שגיאה בשרת RunPod: השרת לא זמין כרגע. אנא נסה שוב בעוד כמה רגעים.";
            } else {
              errorMessage = text || `שגיאת שרת (קוד ${res.status})`;
            }
          } else {
            errorMessage = `שגיאת שרת (קוד ${res.status})`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await res.json();
      
      // השלמת ה-progress bar ל-100%
      setProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      // תמיכה בפורמט החדש (video) והישן (url)
      const videoData = {
        ...data,
        url: data.video || data.url, // תאימות לאחור
      };
      
      setCurrentVideo(videoData);
      
      // רענון ההיסטוריה מהשרת כדי להבטיח סינכרון
      await fetchHistory();
      
      // גלילה חלקה לסרטון שנוצר
      setTimeout(() => {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
      
      // איפוס ה-progress אחרי שנייה
      setTimeout(() => setProgress(0), 1000);
    } catch (e) {
      console.error(e);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setProgress(0);
      
      // הודעת שגיאה ברורה
      let errorMessage = e.message || "שגיאה ביצירת הווידאו";
      if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
        errorMessage = "שגיאת חיבור: לא ניתן להתחבר לשרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.";
      }
      setError(errorMessage);
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
        {/* לוגו KRSTUDIO וקישור חזרה */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              background: "linear-gradient(135deg, #6366f1, #ec4899, #f97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.5px"
            }}>
              KRSTUDIO
            </div>
          </div>
          <a 
            href="/" 
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "#1f2937",
              color: "#f9fafb",
              textDecoration: "none",
              fontSize: 14,
              border: "1px solid #374151",
              transition: "all 0.2s",
              cursor: "pointer",
              display: "inline-block"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#374151";
              e.target.style.borderColor = "#4f46e5";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#1f2937";
              e.target.style.borderColor = "#374151";
            }}
          >
            ← חזרה לדף הבית
          </a>
        </div>
        
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
                width: "100%",
              }}
            >
              {loading ? "מייצר וידאו..." : "Generate Video"}
            </button>

            {/* Progress Bar */}
            {loading && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  fontSize: 14,
                }}>
                  <span style={{ opacity: 0.8 }}>מתקדם...</span>
                  <span style={{ 
                    fontWeight: 600,
                    background: "linear-gradient(135deg, #6366f1, #ec4899)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                    {progress}%
                  </span>
                </div>
                <div style={{
                  width: "100%",
                  height: 8,
                  background: "#1f2937",
                  borderRadius: 999,
                  overflow: "hidden",
                  border: "1px solid #374151",
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #6366f1, #ec4899, #f97316)",
                    borderRadius: 999,
                    transition: "width 0.3s ease",
                    boxShadow: "0 0 10px rgba(99, 102, 241, 0.5)",
                  }} />
                </div>
              </div>
            )}

            {/* הודעת שגיאה משופרת */}
            {error && (
              <div style={{ 
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 10,
                background: "#7f1d1d",
                border: "1px solid #991b1b",
                color: "#fecaca",
              }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <strong style={{ fontSize: 14 }}>שגיאה:</strong>
                </div>
                <p style={{ 
                  margin: 0, 
                  fontSize: 13,
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}>
                  {error}
                </p>
              </div>
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

