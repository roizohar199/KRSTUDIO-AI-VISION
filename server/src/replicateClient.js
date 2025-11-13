import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../../outputs");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PORT = process.env.PORT || 4000;
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || `http://localhost:${PORT}`;

const HF_TOKEN = process.env.HF_TOKEN;

const HF_IMAGE_MODEL_URL =
  process.env.HF_IMAGE_MODEL_URL ||
  "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
const HF_VIDEO_MODEL_URL =
  process.env.HF_VIDEO_MODEL_URL ||
  "https://api-inference.huggingface.co/models/cerspense/zeroscope_v2_576w";

async function postToHuggingFace(modelUrl, payload) {
  if (!HF_TOKEN) {
    throw new Error("Missing HF_TOKEN for Hugging Face API");
  }

  const response = await fetch(modelUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Hugging Face error:", response.status, errText);
    throw new Error(`Hugging Face request failed (${response.status}): ${errText}`);
  }

  return response;
}

async function writeBufferToFile(buffer, extension) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const filePath = path.join(OUTPUT_DIR, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `${SERVER_PUBLIC_URL}/outputs/${filename}`;
}

// === יצירת תמונה ===
export async function generateImageFromPrompt(prompt) {
  const response = await postToHuggingFace(HF_IMAGE_MODEL_URL, { inputs: prompt });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return writeBufferToFile(buffer, "png");
}

// === יצירת וידאו (5–8 שניות) ===
export async function generateVideoFromPrompt(prompt) {
  const response = await postToHuggingFace(HF_VIDEO_MODEL_URL, { inputs: prompt });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return writeBufferToFile(buffer, "mp4");
}
