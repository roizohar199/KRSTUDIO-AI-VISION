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

/**
 * GPU BASE + ENDPOINTS
 * --------------------
 * .env מומלץ:
 *   GPU_SERVER=https://XXXXX-8000.proxy.runpod.net
 *   (לא לשים /generate בסוף)
 */
const GPU_BASE = process.env.GPU_SERVER || process.env.GPU_BASE || null;

// בפועל קיימים בפוד רק שני מודלים:
//   POST /generate/mochi
//   POST /generate/cogvideo
const MOCHI_SERVER =
  process.env.MOCHI_SERVER || (GPU_BASE ? `${GPU_BASE}/generate/mochi` : null);

const COGVIDEO_SERVER =
  process.env.COG_SERVER ||
  process.env.COGVIDEO_SERVER ||
  (GPU_BASE ? `${GPU_BASE}/generate/cogvideo` : null);


const SDXL_SERVER = process.env.SDXL_SERVER || null; // לעתיד – יצירת תמונה

/**
 * ============================
 *  Simple Auth Placeholders
 * ============================
 */
function requireAuth(req, res, next) {
  // TODO: לחבר Auth אמיתי (JWT / Auth0)
  return next();
}

function requireAdmin(req, res, next) {
  const isAdmin = true; // להחליף בבדיקת הרשאות אמיתית בעתיד
  if (!isAdmin) {
    return res.status(403).json({ error: "admin only" });
  }
  next();
}

/**
 * ============================
 *  API Key Guard (לשימוש חיצוני)
 * ============================
 */
function apiKeyGuard(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "API key required" });

  const allowed = (process.env.API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (!allowed.includes(key)) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}

/**
 * ============================
 *  Simple Queue – מניעת עומס GPU
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
 *  Helpers
 * ============================
 */

function getModelEndpoint(model) {
  switch (model) {
    case "mochi":
      return MOCHI_SERVER;

    case "cogvideo":
    case "cog":
      return COGVIDEO_SERVER;

    default:
      return null;
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
    gpuBase: GPU_BASE || null,
    endpoints: {
      mochi: MOCHI_SERVER,
      cogvideo: COGVIDEO_SERVER,
    },
  });
});


app.get("/api/video/health", (req, res) => {
  res.json({
    ok: true,
    queueSize: videoQueue.length,
    gpuBase: GPU_BASE || null,
    models: {
      mochi: !!MOCHI_SERVER,
      cogvideo: !!COGVIDEO_SERVER,
    },
  });
});


/**
 * ============================
 *  1) Generate Video (Multi-Model Support)
 *  Route: POST /api/video/generate
 *  Supports: mochi, cogvideo
 * ============================
 */

app.post("/api/video/generate", requireAuth, async (req, res) => {
  const {
    prompt,
    model = "mochi", // ברירת מחדל: MOCHI
    seconds = 15,
    fps = 24,
    width = 512,
    height = 512,
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!["mochi", "cogvideo", "cog"].includes(model)) {
    return res.status(400).json({
      error: "model must be one of: mochi, cogvideo",
    });
  }

  const endpoint = getModelEndpoint(model);
  if (!endpoint) {
    return res.status(500).json({
      error: `GPU endpoint for model '${model}' is not configured on server`,
    });
  }

  if (!GPU_BASE) {
    return res
      .status(500)
      .json({ error: "GPU_SERVER (GPU_BASE) not configured on server" });
  }

  try {
    const num_frames = Math.round((seconds || 15) * (fps || 24));

    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          num_frames,
          fps,
          width,
          height,
        }),
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      const data = await gpuRes.json();
      return {
        success: data.success !== false,
        video: data.video,
        model,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpuBase: GPU_BASE });
  }
});


/**
 * ============================
 *  2) Generate Image (SDXL) – placeholder
 *  Route: POST /api/generate-image
 * ============================
 */

app.post("/api/generate-image", requireAuth, async (req, res) => {
  const { prompt, width, height } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!SDXL_SERVER) {
    return res.status(500).json({ error: "SDXL_SERVER not configured" });
  }

  try {
    const imgRes = await fetch(SDXL_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        width: width || 1024,
        height: height || 1024,
      }),
    });

    if (!imgRes.ok) {
      const txt = await imgRes.text();
      return res.status(500).json({ error: "image error", details: txt });
    }

    const data = await imgRes.json();
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
 *  3) Image → Video (Conditioning) – not yet implemented
 *  Route: POST /api/generate-video-from-image
 * ============================
 */

app.post(
  "/api/generate-video-from-image",
  requireAuth,
  async (req, res) => {
    return res.status(501).json({
      error: "image->video conditioning not implemented yet on GPU server",
    });
  }
);

/**
 * ============================
 *  4) External API (עם API Key)
 *  Route: POST /api/external/generate-video
 *  model ברירת מחדל: mochi
 * ============================
 */

app.post("/api/external/generate-video", apiKeyGuard, async (req, res) => {
  const {
    prompt,
    seconds = 15,
    fps = 24,
    height = 512,
    width = 512,
    model = "mochi",
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const endpoint = getModelEndpoint(model);
  if (!endpoint) {
    return res.status(500).json({
      error: `GPU endpoint for model '${model}' is not configured on server`,
    });
  }

  if (!GPU_BASE) {
    return res
      .status(500)
      .json({ error: "GPU_SERVER (GPU_BASE) not configured on server" });
  }

  try {
    const num_frames = Math.round((seconds || 15) * (fps || 24));

    const result = await enqueueJob(async () => {
      const gpuRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          num_frames,
          fps,
          height,
          width,
        }),
      });

      if (!gpuRes.ok) {
        const txt = await gpuRes.text();
        throw new Error(`GPU error: ${txt}`);
      }

      const data = await gpuRes.json();
      return {
        success: data.success !== false,
        video: data.video,
        model,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("SERVER ERROR (external video):", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpuBase: GPU_BASE });
  }
});

/**
 * ============================
 *  5) Admin Routes (סקיצה)
 * ============================
 */

app.get("/api/admin/videos", requireAuth, requireAdmin, (req, res) => {
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
