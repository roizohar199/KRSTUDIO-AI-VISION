import express from "express";
import fetch from "node-fetch";
import { generateImageFromPrompt, generateVideoFromPrompt } from "../src/replicateClient.js";

const router = express.Router();

// === יצירת תמונה ===
router.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const imageUrl = await generateImageFromPrompt(prompt);
    return res.json({ image: imageUrl });
  } catch (err) {
    console.error("Image generation error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate image" });
  }
});

// === יצירת וידאו ===
router.post("/generate-video", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const videoUrl = await generateVideoFromPrompt(prompt);
    return res.json({ video: videoUrl });
  } catch (err) {
    console.error("Video generation error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate video" });
  }
});

// === LTX Video (legacy endpoint) ===
router.post("/ltx-video", async (req, res) => {
  const { prompt } = req.body;

  try {
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/Lightricks/LTX-Video",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_frames: 49,
            height: 704,
            width: 1216
          }
        })
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      return res.status(500).json({ error: errText });
    }

    const buffer = Buffer.from(await hfRes.arrayBuffer());
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'inline; filename="ltx.mp4"');
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "LTX request failed" });
  }
});

export default router;

