# FILE: gpu-server/main.py
import base64
import os
from pathlib import Path
from typing import Optional

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
    num_frames: int = 49
    fps: int = 24
    width: int = 512
    height: int = 512
    # פרמטרים אופציונליים נוספים
    negative_prompt: Optional[str] = ""
    num_inference_steps: Optional[int] = None
    guidance_scale: Optional[float] = None
    seed: Optional[int] = None


def _pick_seed(seed: Optional[int]) -> int:
    import random
    return seed if seed is not None else random.randint(0, 2**31 - 1)


def _encode_video_to_data_url(path: Path, mime_type: str = "video/mp4") -> str:
    """ממיר וידאו ל-data URL"""
    with open(path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


def _generate_video_common(
    model_name: str,
    generate_func,
    req: GenerateRequest,
) -> dict:
    """פונקציה משותפת ליצירת וידאו"""
    seed = _pick_seed(req.seed)
    
    # פרמטרים ברירת מחדל אם לא צוינו
    num_inference_steps = req.num_inference_steps or 50
    guidance_scale = req.guidance_scale or 6.0
    
    try:
        out_path = generate_func(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt or "",
            width=req.width,
            height=req.height,
            num_frames=req.num_frames,
            fps=req.fps,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            seed=seed,
            out_dir=OUTPUT_DIR,
        )
        
        video_data_url = _encode_video_to_data_url(out_path)
        
        return {
            "success": True,
            "video": video_data_url,
            "model": model_name,
            "filename": out_path.name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/ltx")
def generate_ltx(req: GenerateRequest):
    """יצירת וידאו עם LTX"""
    return _generate_video_common("ltx", generate_ltx_video, req)


@app.post("/generate/mochi")
def generate_mochi(req: GenerateRequest):
    """יצירת וידאו עם Mochi"""
    return _generate_video_common("mochi", generate_mochi_video, req)


@app.post("/generate/cog")
def generate_cog(req: GenerateRequest):
    """יצירת וידאו עם CogVideoX"""
    return _generate_video_common("cogvideo", generate_cogvideo_video, req)


# תאימות לאחור - endpoint אחד עם פרמטר model
@app.post("/generate")
def generate_video_legacy(req: dict):
    """Legacy endpoint - תאימות לאחור"""
    model = req.get("model", "ltx")
    
    # המרת request לפורמט החדש
    generate_req = GenerateRequest(
        prompt=req.get("prompt", ""),
        num_frames=req.get("num_frames", 49),
        fps=req.get("fps", 24),
        width=req.get("width", 512),
        height=req.get("height", 512),
        negative_prompt=req.get("negative_prompt", ""),
        num_inference_steps=req.get("num_inference_steps"),
        guidance_scale=req.get("guidance_scale"),
        seed=req.get("seed"),
    )
    
    if model == "ltx":
        return _generate_video_common("ltx", generate_ltx_video, generate_req)
    elif model == "mochi":
        return _generate_video_common("mochi", generate_mochi_video, generate_req)
    elif model in ["cogvideo", "cog"]:
        return _generate_video_common("cogvideo", generate_cogvideo_video, generate_req)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
