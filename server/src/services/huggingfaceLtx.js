import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

const HF_TOKEN = process.env.HF_TOKEN;
const HF_LTX_MODEL = process.env.HF_LTX_MODEL || "Lightricks/LTX-Video";
const TMP_CLIPS_DIR = path.join(process.cwd(), "tmp", "clips");

export async function generateLtxClip({
  prompt,
  num_frames = 96,
  width = 1216,
  height = 704,
  fps = 24,
  guidance_scale = 1,
  outputDir = TMP_CLIPS_DIR,
  filenamePrefix = "clip"
}) {
  if (!prompt) {
    throw new Error("Prompt is required for LTX clip generation");
  }

  if (!HF_TOKEN) {
    throw new Error("HF_TOKEN is missing from environment");
  }

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${HF_LTX_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_frames,
          width,
          height,
          fps,
          guidance_scale
        }
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error("Hugging Face LTX-Video request failed");
    err.status = response.status;
    err.details = errText;
    throw err;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.mkdir(outputDir, { recursive: true });
  const filename = `${filenamePrefix}_${Date.now()}.mp4`;
  const filePath = path.join(outputDir, filename);
  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    filename,
    bytes: buffer.length,
    prompt,
    meta: {
      num_frames,
      width,
      height,
      fps,
      guidance_scale,
      model: HF_LTX_MODEL
    }
  };
}

