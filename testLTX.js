const fs = require("fs");

const HF_TOKEN = process.env.HF_TOKEN;

if (!HF_TOKEN) {
  console.error("❌ Error: HF_TOKEN environment variable is required");
  process.exit(1);
}

const prompt =
  "A cinematic video of a cat and dog playing together in a sunny garden, 30fps, 1216x704, high quality";

async function run() {
  console.log("🎬 Generating video from Hugging Face...");
  const res = await fetch("https://router.huggingface.co/hf-inference/models/Lightricks/LTX-Video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt })
  });

  if (!res.ok) {
    console.error("❌ Error:", await res.text());
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync("ltx_test.mp4", buffer);
  console.log("✅ Video saved as ltx_test.mp4");
}

run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exitCode = 1;
});

