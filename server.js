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
const GPU_SERVER = process.env.GPU_SERVER || process.env.LTX_SERVER; // כתובת ה-GPU שלך (RunPod) - תומך ב-3 מודלים
const LTX_SERVER = process.env.LTX_SERVER || GPU_SERVER; // תאימות לאחור
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
    gpu: GPU_SERVER || null
  });
});

app.get("/api/video/health", (req, res) => {
  res.json({
    ok: true,
    queueSize: videoQueue.length,
    gpu: GPU_SERVER || null,
    models: ["ltx", "mochi", "cogvideo"]
  });
});

/**
 * ============================
 *  1) Generate Video (Multi-Model Support)
 *  Route: POST /api/video/generate
 *  Supports: ltx, mochi, cogvideo
 * ============================
 */

app.post("/api/video/generate", requireAuth, async (req, res) => {
  const { 
    prompt, 
    model = "ltx",
    negative_prompt = "",
    seconds = 15,
    fps = 10,
    width = 3840,
    height = 2160,
    num_inference_steps = 50,
    guidance_scale = 6.0,
    seed = null
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!["ltx", "mochi", "cogvideo"].includes(model)) {
    return res.status(400).json({ error: "model must be one of: ltx, mochi, cogvideo" });
  }

  if (!GPU_SERVER) {
    return res.status(500).json({ error: "GPU_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(`${GPU_SERVER}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt,
          model,
          seconds,
          fps,
          width,
          height,
          num_inference_steps,
          guidance_scale,
          seed
        })
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      const data = await gpuRes.json();
      
      // המרת base64 ל-URL data
      return {
        ...data,
        url: `data:${data.mime_type};base64,${data.video_base64}`,
        model: data.model
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpu: GPU_SERVER });
  }
});

/**
 * ============================
 *  1a) Generate Video (LTX) - Legacy endpoint for backward compatibility
 *  Route: POST /api/ltx/generate-video
 * ============================
 */

app.post("/api/ltx/generate-video", requireAuth, async (req, res) => {
  const { prompt, num_frames, fps, height, width, num_inference_steps, guidance_scale, seed } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!GPU_SERVER) {
    return res.status(500).json({ error: "GPU_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      // המרת פרמטרים ישנים לפורמט החדש
      const seconds = Math.ceil((num_frames || 49) / (fps || 24));
      
      const gpuRes = await fetch(`${GPU_SERVER}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: "ltx",
          seconds,
          fps: fps || 24,
          width: width || 512,
          height: height || 512,
          num_inference_steps: num_inference_steps || 50,
          guidance_scale: guidance_scale || 6.0,
          seed
        })
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      const data = await gpuRes.json();
      
      // המרת base64 ל-URL data
      return {
        ...data,
        url: `data:${data.mime_type};base64,${data.video_base64}`,
        model: "ltx"
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpu: GPU_SERVER });
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

  if (!GPU_SERVER) {
    return res.status(500).json({ error: "GPU_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(GPU_SERVER, {
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
      .json({ error: "server error", details: String(err), gpu: GPU_SERVER });
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

  if (!GPU_SERVER) {
    return res.status(500).json({ error: "GPU_SERVER not configured on server" });
  }

  try {
    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(GPU_SERVER, {
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
      .json({ error: "server error", details: String(err), gpu: GPU_SERVER });
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

