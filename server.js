import express from "express";
import cors from "cors";
import "dotenv/config";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4100;
const LTX_SERVER = process.env.LTX_SERVER;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "KRSTUDIO AI VISION",
    gpu: LTX_SERVER || null
  });
});

app.post("/api/generate-video", async (req, res) => {
  const { prompt, num_frames, fps, height, width } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!LTX_SERVER) {
    return res.status(500).json({ error: "LTX_SERVER not configured on server" });
  }

  try {
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
      return res
        .status(500)
        .json({ error: "GPU error", details: txt, gpu: LTX_SERVER });
    }

    const data = await gpuRes.json();
    return res.json(data);
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res
      .status(500)
      .json({ error: "server error", details: String(err), gpu: LTX_SERVER });
  }
});

app.listen(PORT, () => {
  console.log(`KRSTUDIO AI VISION running on port ${PORT}`);
});

