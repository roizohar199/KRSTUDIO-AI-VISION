# FILE: gpu-server/main.py
import base64
import os
from pathlib import Path
from typing import Optional, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ltx_pipeline import generate_ltx_video
from mochi_pipeline import generate_mochi_video
from cogvideo_pipeline import generate_cogvideo_video

app = FastAPI(title="KRSTUDIO AI VISION GPU Server")

OUTPUT_DIR = Path(os.environ.get("VIDEO_OUTPUT_DIR", "/workspace/outputs"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    model: Literal["ltx", "mochi", "cogvideo"]
    # seconds & fps → נהפוך לפריימים
    seconds: int = 15
    fps: int = 10
    width: int = 3840   # 4K
    height: int = 2160  # 4K
    num_inference_steps: int = 50
    guidance_scale: float = 6.0
    seed: Optional[int] = None


class GenerateResponse(BaseModel):
    model: str
    filename: str
    video_base64: str
    mime_type: str = "video/mp4"
    fps: int
    seconds: float


def _clamp_frames(seconds: int, fps: int) -> int:
    frames = seconds * fps
    # רוב המודלים עובדים טוב עד ~161 פריימים
    return min(frames, 161)


def _pick_seed(seed: Optional[int]) -> int:
    import random
    return seed if seed is not None else random.randint(0, 2**31 - 1)


def _encode_video_to_base64(path: Path) -> str:
    with open(path, "rb") as f:
        data = f.read()
    return base64.b64encode(data).decode("ascii")


@app.post("/generate", response_model=GenerateResponse)
def generate_video(req: GenerateRequest):
    seed = _pick_seed(req.seed)
    num_frames = _clamp_frames(req.seconds, req.fps)

    try:
        if req.model == "ltx":
            out_path = generate_ltx_video(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt or "",
                width=req.width,
                height=req.height,
                num_frames=num_frames,
                fps=req.fps,
                num_inference_steps=req.num_inference_steps,
                guidance_scale=req.guidance_scale,
                seed=seed,
                out_dir=OUTPUT_DIR,
            )
        elif req.model == "mochi":
            out_path = generate_mochi_video(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt or "",
                width=req.width,
                height=req.height,
                num_frames=num_frames,
                fps=req.fps,
                num_inference_steps=req.num_inference_steps,
                guidance_scale=req.guidance_scale,
                seed=seed,
                out_dir=OUTPUT_DIR,
            )
        elif req.model == "cogvideo":
            out_path = generate_cogvideo_video(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt or "",
                width=req.width,
                height=req.height,
                num_frames=num_frames,
                fps=req.fps,
                num_inference_steps=req.num_inference_steps,
                guidance_scale=req.guidance_scale,
                seed=seed,
                out_dir=OUTPUT_DIR,
            )
        else:
            raise HTTPException(status_code=400, detail="Unknown model")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    b64 = _encode_video_to_base64(out_path)
    seconds_real = num_frames / req.fps

    return GenerateResponse(
        model=req.model,
        filename=out_path.name,
        video_base64=b64,
        fps=req.fps,
        seconds=seconds_real,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
