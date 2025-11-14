import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const RUNPOD_LTX_BASE_URL =
  process.env.RUNPOD_LTX_BASE_URL ||
  "https://rmo5wr1h48d38t-8000.proxy.runpod.net";

const DATA_DIR = path.join(__dirname, "..", "data");
const HISTORY_FILE = path.join(DATA_DIR, "videos.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, "[]", "utf8");
}

function readHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading videos history:", e);
    return [];
  }
}

function writeHistory(items) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(items, null, 2), "utf8");
}

// POST /api/ltx/generate
router.post("/generate", async (req, res) => {
  const {
    prompt,
    num_frames,
    width,
    height,
    fps,
    num_inference_steps,
    image_base64,
  } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const body = {
      prompt,
      num_frames: num_frames ?? 81,
      width: width ?? 768,
      height: height ?? 512,
      fps: fps ?? 24,
      num_inference_steps: num_inference_steps ?? 28,
      image_base64: image_base64 ?? null,
    };

    const response = await fetch(`${RUNPOD_LTX_BASE_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = "";
      }
      
      console.error("RunPod LTX error:", response.status, errorText);
      
      // הודעות שגיאה ברורות יותר לפי סטטוס
      let errorMessage = "שגיאה בשרת RunPod";
      if (response.status === 500 || response.status === 503) {
        errorMessage = "LTX backend failed - השרת לא זמין כרגע או שיש בעיה בחיבור";
      } else if (response.status === 504 || response.status === 408) {
        errorMessage = "LTX backend timeout - השרת לא הגיב בזמן. נסה שוב";
      } else if (response.status === 429) {
        errorMessage = "LTX backend rate limit - יותר מדי בקשות. אנא המתן";
      } else if (response.status === 400) {
        errorMessage = "LTX backend bad request - בקשה לא תקינה";
      } else if (response.status === 502) {
        errorMessage = "LTX backend bad gateway - בעיה בחיבור לשרת RunPod";
      }
      
      return res
        .status(500)
        .json({ 
          error: errorMessage,
          status: response.status,
          details: errorText || "No additional details"
        });
    }

    const data = await response.json(); // { file, url, used_image }
    const fullUrl = `${RUNPOD_LTX_BASE_URL}${data.url}`;

    const history = readHistory();
    const id = Date.now().toString();
    const record = {
      id,
      prompt,
      file: data.file,
      url: fullUrl,
      createdAt: new Date().toISOString(),
      used_image: !!data.used_image,
      params: body,
    };
    history.unshift(record); // האחרון למעלה
    writeHistory(history);

    return res.json(record);
  } catch (err) {
    console.error("Error in /api/ltx/generate:", err);
    
    // זיהוי סוגי שגיאות נפוצים
    let errorMessage = "Server error";
    if (err.message && err.message.includes("fetch")) {
      errorMessage = "שגיאת חיבור לשרת RunPod - לא ניתן להתחבר לשרת";
    } else if (err.message && err.message.includes("timeout")) {
      errorMessage = "שגיאת timeout - השרת לא הגיב בזמן";
    } else if (err.message) {
      errorMessage = `Server error: ${err.message}`;
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: err.message || "Unknown error"
    });
  }
});

// GET /api/ltx/history
router.get("/history", (req, res) => {
  const history = readHistory();
  res.json(history);
});

// DELETE /api/ltx/history/:id
router.delete("/history/:id", (req, res) => {
  const { id } = req.params;
  const history = readHistory();
  const idx = history.findIndex((v) => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Not found" });
  }
  const [removed] = history.splice(idx, 1);
  writeHistory(history);
  res.json({ ok: true, removed });
});

export default router;

