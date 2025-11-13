import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import cors from "cors";
import path from "path";
import ltxRoutes from "../routes/ltx.js";
import ltxRoutesNew from "../routes/ltxRoutes.js";

const app = express();
const PORT = process.env.PORT || 4100;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5174";

const corsOptions = {
  origin: CLIENT_ORIGIN,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "50mb" }));

const tmpDir = path.join(process.cwd(), "tmp");
app.use("/tmp", express.static(tmpDir));
const outputsDir = path.join(process.cwd(), "outputs");
app.use("/outputs", express.static(outputsDir));

app.use("/api", ltxRoutes);

// Health check endpoint - לפני ה-router
app.get("/api/ltx", (req, res) => {
  res.json({
    ok: true,
    service: "KRSTUDIO AI VISION",
    model: "Lightricks/LTX-Video-0.9.7-distilled"
  });
});

app.use("/api/ltx", ltxRoutesNew);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("CORS allowed for:", CLIENT_ORIGIN);
});
