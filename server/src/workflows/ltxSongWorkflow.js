import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

import { generateLtxClip } from "../services/huggingfaceLtx.js";

const TMP_ROOT = path.join(process.cwd(), "tmp");
const JOBS_DIR = path.join(TMP_ROOT, "jobs");

const DEFAULT_BASE_STYLE =
  "cinematic, mediterranean vibe, soft warm light, realistic, 30fps, high quality, filmed on Alexa Mini";

const PROMPT_TEMPLATES = {
  intro: "intro shot, studio lights, KRSTUDIO logo reveal, subtle motion",
  verse: "emotional verse scene, night city street, intimate lonely mood",
  chorus: "chorus scene, bright colors, golden hour glow, dynamic camera move",
  bridge: "bridge sequence, dramatic lighting, abstract particles, tension build-up",
  outro: "outro shot, KRSTUDIO logo, spotlight, slow fade out",
  fallback: "musical performance, cinematic framing, moody lighting"
};

const DEFAULT_STRUCTURE = [
  { key: "intro", durationSec: 5 },
  { key: "verse", durationSec: 10, repeat: 2 },
  { key: "chorus", durationSec: 8 },
  { key: "verse", durationSec: 10, repeat: 2 },
  { key: "bridge", durationSec: 8 },
  { key: "chorus", durationSec: 8 },
  { key: "outro", durationSec: 6 }
];

function resolvePromptTemplate(key, baseStyle, extraStyle) {
  const template = PROMPT_TEMPLATES[key] || PROMPT_TEMPLATES.fallback;
  const additive = extraStyle?.length ? `, ${extraStyle.join(", ")}` : "";
  return `${template}, ${baseStyle}${additive}`;
}

function expandStructure(structure = []) {
  return structure.flatMap((segment) => {
    const repeat = Math.max(segment.repeat || 1, 1);
    return Array.from({ length: repeat }, (_, idx) => ({
      ...segment,
      instance: idx + 1
    }));
  });
}

function totalDurationFromStructure(structure = []) {
  return structure.reduce((acc, seg) => acc + (seg.durationSec || 0), 0);
}

export function planShots({
  lyrics,
  songDurationSec = 210,
  clipDurationSec = 6,
  structure,
  baseStyle = DEFAULT_BASE_STYLE,
  extraStyle = []
}) {
  const chosenStructure = structure?.length ? structure : DEFAULT_STRUCTURE;
  const expandedStructure = expandStructure(chosenStructure);

  let cumulativeDuration = 0;
  const shots = expandedStructure.map((segment, idx) => {
    const durationSec = segment.durationSec || clipDurationSec;
    const prompt =
      segment.prompt ||
      resolvePromptTemplate(segment.key || `section_${idx + 1}`, baseStyle, extraStyle);

    const shot = {
      id: idx + 1,
      label: segment.label || segment.key || `section_${idx + 1}`,
      prompt,
      durationSec,
      startSec: cumulativeDuration,
      lyricsExcerpt: extractLyricsExcerpt(lyrics, idx)
    };

    cumulativeDuration += durationSec;
    return shot;
  });

  // If our planned duration is shorter than the song length, loop prompts until we cover.
  const plannedDuration = totalDurationFromStructure(expandedStructure);
  if (plannedDuration < songDurationSec) {
    const loopNeeded = Math.ceil(songDurationSec / plannedDuration);
    const loopedShots = [];
    for (let i = 0; i < loopNeeded; i += 1) {
      shots.forEach((shot) => {
        const clone = { ...shot };
        clone.loop = i + 1;
        clone.startSec = loopedShots.reduce((acc, current) => acc + current.durationSec, 0);
        loopedShots.push(clone);
      });
    }
    return {
      shots: loopedShots.slice(0, Math.ceil(songDurationSec / clipDurationSec)),
      plannedDuration: loopedShots.reduce((acc, seg) => acc + seg.durationSec, 0)
    };
  }

  return {
    shots,
    plannedDuration
  };
}

function extractLyricsExcerpt(lyrics, index) {
  if (!lyrics) return null;
  const blocks = lyrics.split(/\n\s*\n/).map((block) => block.trim());
  if (!blocks.length) return null;
  const safeIndex = index % blocks.length;
  return blocks[safeIndex];
}

async function runFfmpeg(args, { logPrefix = "ffmpeg", cwd } = {}) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-y", ...args], {
      cwd,
      stdio: "inherit"
    });

    ff.on("error", (err) => {
      const error = new Error(`[${logPrefix}] Failed to start ffmpeg: ${err.message}`);
      error.cause = err;
      reject(error);
    });

    ff.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`[${logPrefix}] ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function concatClips(clipPaths, concatFilePath, outputPath) {
  const normalized = clipPaths.map((clip) => clip.replace(/\\/g, "/"));
  const concatContent = normalized.map((clip) => `file '${clip}'`).join("\n");
  await fs.writeFile(concatFilePath, concatContent, "utf8");

  await runFfmpeg(
    ["-f", "concat", "-safe", "0", "-i", concatFilePath, "-c", "copy", outputPath],
    { logPrefix: "concat" }
  );
}

async function attachAudio(videoPath, audioPath, outputPath) {
  await runFfmpeg(
    ["-i", videoPath, "-i", audioPath, "-c:v", "copy", "-c:a", "aac", "-shortest", outputPath],
    { logPrefix: "mux" }
  );
}

async function overlayLogo(videoPath, logoPath, outputPath, { x = 10, y = 10 } = {}) {
  await runFfmpeg(
    [
      "-i",
      videoPath,
      "-i",
      logoPath,
      "-filter_complex",
      `overlay=${x}:${y}`,
      "-codec:a",
      "copy",
      outputPath
    ],
    { logPrefix: "logo" }
  );
}

async function makeVertical(videoPath, outputPath, { width = 1080, height = 1920 } = {}) {
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  await runFfmpeg(["-i", videoPath, "-vf", vf, "-c:a", "copy", outputPath], { logPrefix: "vertical" });
}

async function burnSubtitles(videoPath, subtitlesPath, outputPath) {
  const normalizedSub = subtitlesPath.replace(/\\/g, "/");
  await runFfmpeg(
    ["-i", videoPath, "-vf", `subtitles=${normalizedSub}`, outputPath],
    { logPrefix: "subtitles" }
  );
}

export async function runSongToVideoWorkflow({
  lyrics,
  songDurationSec = 210,
  clipDurationSec = 6,
  structure,
  baseStyle = DEFAULT_BASE_STYLE,
  extraStyle = [],
  songFilePath,
  logoPath,
  subtitlesPath,
  makeVerticalVersion = false,
  verticalResolution = { width: 1080, height: 1920 },
  logoPosition = { x: 10, y: 10 },
  modelParameters = {}
} = {}) {
  const jobId = randomUUID();
  const jobDir = path.join(JOBS_DIR, jobId);
  const clipsDir = path.join(jobDir, "clips");

  await fs.mkdir(clipsDir, { recursive: true });

  const { shots } = planShots({
    lyrics,
    songDurationSec,
    clipDurationSec,
    structure,
    baseStyle,
    extraStyle
  });

  const clipMetadata = [];
  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    const clipResult = await generateLtxClip({
      prompt: shot.prompt,
      outputDir: clipsDir,
      filenamePrefix: `shot_${String(shot.id).padStart(2, "0")}`,
      ...modelParameters
    });

    clipMetadata.push({
      ...shot,
      filePath: clipResult.filePath,
      bytes: clipResult.bytes,
      modelMeta: clipResult.meta
    });
  }

  const concatFilePath = path.join(jobDir, "concat.txt");
  const stitchedVideoPath = path.join(jobDir, "ltx_master.mp4");
  const outputs = {
    jobId,
    jobDir,
    clipsDir,
    concatFilePath,
    stitchedVideoPath: null,
    withAudioPath: null,
    withLogoPath: null,
    verticalPath: null,
    subtitlesPath: null,
    clips: clipMetadata
  };

  const clipPaths = clipMetadata.map((clip) => clip.filePath);
  await concatClips(clipPaths, concatFilePath, stitchedVideoPath);
  outputs.stitchedVideoPath = stitchedVideoPath;

  if (songFilePath) {
    const audioMuxPath = path.join(jobDir, "ltx_with_audio.mp4");
    await attachAudio(stitchedVideoPath, songFilePath, audioMuxPath);
    outputs.withAudioPath = audioMuxPath;
  }

  const baseForPost = outputs.withAudioPath || outputs.stitchedVideoPath;

  if (logoPath) {
    const logoOutPath = path.join(jobDir, "ltx_with_logo.mp4");
    await overlayLogo(baseForPost, logoPath, logoOutPath, logoPosition);
    outputs.withLogoPath = logoOutPath;
  }

  const postLogoBase = outputs.withLogoPath || baseForPost;

  if (makeVerticalVersion) {
    const verticalOutPath = path.join(jobDir, "ltx_vertical.mp4");
    await makeVertical(postLogoBase, verticalOutPath, verticalResolution);
    outputs.verticalPath = verticalOutPath;
  }

  const postVerticalBase = outputs.verticalPath || postLogoBase;

  if (subtitlesPath) {
    const subtitlesOutPath = path.join(jobDir, "ltx_with_subs.mp4");
    await burnSubtitles(postVerticalBase, subtitlesPath, subtitlesOutPath);
    outputs.subtitlesPath = subtitlesOutPath;
  }

  await fs.writeFile(
    path.join(jobDir, "metadata.json"),
    JSON.stringify(
      {
        jobId,
        createdAt: new Date().toISOString(),
        lyricsProvided: Boolean(lyrics),
        songDurationSec,
        clipDurationSec,
        baseStyle,
        extraStyle,
        modelParameters,
        outputs
      },
      null,
      2
    ),
    "utf8"
  );

  return outputs;
}

