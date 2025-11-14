// FILE: server.js
import express from "express";
import cors from "cors";
import "dotenv/config";
import fetch from "node-fetch";

/**
 * ============================
 *  Basic App & Config
 * ============================
 */
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4100;
const LTX_SERVER = process.env.LTX_SERVER; // כתובת ה-GPU שלך (RunPod)
const SDXL_SERVER = process.env.SDXL_SERVER || null; // אם תרצה שרת נפרד ל-SDXL

/**
 * ============================
 *  Simple Auth Placeholders
 * ============================
 * כאן בעתיד נכניס JWT/Auth0 וכו'
 */
function requireAuth(req, res, next) {
  // TODO: החלף במימוש אמיתי כאשר תהיה מערכת AUTH
  // כרגע – מאפשר הכל
  return next();
}

function requireAdmin(req, res, next) {
  // TODO: בדיקה אמיתית אם המשתמש הוא אדמין
  const isAdmin = true; // לשנות כשיהיה AUTH אמיתי
  if (!isAdmin) {
    return res.status(403).json({ error: "admin only" });
  }
  next();
}

/**
 * ============================
 *  API Key Guard (לשימוש חיצוני)
 * ============================
 * ללקוחות חיצוניים שתרצה למכור להם API:
 * הגדרה ב-.env:
 *   API_KEYS=key1,key2,key3
 */
function apiKeyGuard(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "API key required" });

  const allowed = (process.env.API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
  if (!allowed.includes(key)) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}

/**
 * ============================
 *  Simple Queue למניעת עומס GPU
 * ============================
 */

const videoQueue = [];
let isProcessing = false;

function enqueueJob(job) {
  return new Promise((resolve, reject) => {
    videoQueue.push({ job, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing) return;
  const item = videoQueue.shift();
  if (!item) return;

  isProcessing = true;
  const { job, resolve, reject } = item;

  try {
    const result = await job();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    isProcessing = false;
    if (videoQueue.length > 0) processQueue();
  }
}

/**
 * ============================
 *  Health Check
 * ============================
 */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "KRSTUDIO AI VISION",
    gpu: LTX_SERVER || null
  });
});

app.get("/api/ltx/health", (req, res) => {
  res.json({
    ok: true,
    queueSize: videoQueue.length,
    gpu: LTX_SERVER || null
  });
});

/**
 * ============================
 *  1) Generate Video (LTX)
 *  Route: POST /api/ltx/generate-video
 * ============================
 */

app.post("/api/ltx/generate-video", requireAuth, async (req, res) => {
  const { prompt, num_frames, fps, height, width } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!LTX_SERVER) {
    return res.status(500).json({ error: "LTX_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(LTX_SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          num_frames: num_frames || 49,
          fps: fps || 24,
          height: height || 512,
          width: width || 512
        })
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      return gpuRes.json();
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpu: LTX_SERVER });
  }
});

/**
 * ============================
 *  2) Generate Image (SDXL)
 *  Route: POST /api/ltx/generate-image
 *  * כרגע: סקיצה – צריך למלא לפי ה-API שתבחר ל-SDXL
 * ============================
 */

app.post("/api/ltx/generate-image", requireAuth, async (req, res) => {
  const { prompt, width, height } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!SDXL_SERVER) {
    return res.status(500).json({ error: "SDXL_SERVER not configured" });
  }

  try {
    // דוגמה: קריאה לשרת SDXL משלך (או ל-API אחר)
    const imgRes = await fetch(SDXL_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        width: width || 1024,
        height: height || 1024
      })
    });

    if (!imgRes.ok) {
      const txt = await imgRes.text();
      return res.status(500).json({ error: "image error", details: txt });
    }

    const data = await imgRes.json();
    // נניח שהשרת מחזיר { url: "https://..." }
    return res.json(data);
  } catch (err) {
    console.error("SERVER ERROR (image):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err) });
  }
});

/**
 * ============================
 *  3) Image → Video (LTX Conditioning)
 *  Route: POST /api/ltx/generate-video-from-image
 *  * כרגע: סקיצה – תלוי איך LTX תומך בתמונת conditioning
 * ============================
 */

app.post("/api/ltx/generate-video-from-image", requireAuth, async (req, res) => {
  const { prompt, imageUrl, num_frames, fps, height, width } = req.body || {};

  if (!prompt || !imageUrl) {
    return res.status(400).json({ error: "prompt and imageUrl are required" });
  }

  if (!LTX_SERVER) {
    return res.status(500).json({ error: "LTX_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(LTX_SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image_url: imageUrl, // TODO: להתאים לשדה שה-LTX דורש ל-conditioning
          num_frames: num_frames || 49,
          fps: fps || 24,
          height: height || 512,
          width: width || 512
        })
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      return gpuRes.json();
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (image->video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpu: LTX_SERVER });
  }
});

/**
 * ============================
 *  4) External API לדוגמה (למכירה החוצה)
 *  Route: POST /api/external/generate-video
 * ============================
 */

app.post("/api/external/generate-video", apiKeyGuard, async (req, res) => {
  const { prompt, num_frames, fps, height, width } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!LTX_SERVER) {
    return res.status(500).json({ error: "LTX_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(LTX_SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          num_frames: num_frames || 49,
          fps: fps || 24,
          height: height || 512,
          width: width || 512
        })
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      return gpuRes.json();
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (external video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpu: LTX_SERVER });
  }
});

/**
 * ============================
 *  5) Admin Routes (סקיצה לעתיד)
 * ============================
 */

app.get("/api/ltx/admin/videos", requireAuth, requireAdmin, (req, res) => {
  // TODO: לשלוף מתוך DB את היסטוריית הסרטונים, פרמטרים, פרומפטים וכו'
  res.json({ ok: true, items: [] });
});

/**
 * ============================
 *  Start Server
 * ============================
 */

app.listen(PORT, () => {
  console.log(`KRSTUDIO AI VISION running on port ${PORT}`);
});

