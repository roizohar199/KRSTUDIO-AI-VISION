import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const router = express.Router();

const HF_MODEL = process.env.HF_MODEL || "Lightricks/LTX-Video";
const HF_TOKEN = process.env.HF_TOKEN;
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

router.post("/ltx", async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  if (!HF_TOKEN) {
    return res.status(500).json({ error: "Missing HF_TOKEN in environment" });
  }

  try {
    const response = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("HF Error:", errText);
      return res.status(500).json({ error: "HF error", details: errText });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const outDir = path.join(process.cwd(), "outputs");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const filename = `ltx_${Date.now()}.mp4`;
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, buffer);

    return res.json({ success: true, file: `/outputs/${filename}`, path: filepath });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

export default router;

