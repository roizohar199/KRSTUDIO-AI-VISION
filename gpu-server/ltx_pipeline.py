# FILE: gpu-server/ltx_pipeline.py
import os
from pathlib import Path
from typing import List
import torch
from diffusers import LTXPipeline
from diffusers.utils import export_to_video
from PIL import Image

_LTX_PIPE = None
_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def get_ltx_pipe() -> LTXPipeline:
    global _LTX_PIPE
    if _LTX_PIPE is None:
        # מודל בסיסי של LTX-Video דרך diffusers
        _LTX_PIPE = LTXPipeline.from_pretrained(
            "Lightricks/LTX-Video",
            torch_dtype=torch.float16
        )
        _LTX_PIPE.to(_DEVICE)
        # אפשר להוסיף פה אופטימיזציות אם צריך
        # _LTX_PIPE.enable_model_cpu_offload()
    return _LTX_PIPE


def generate_ltx_video(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    num_frames: int,
    fps: int,
    num_inference_steps: int,
    guidance_scale: float,
    seed: int,
    out_dir: Path,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    pipe = get_ltx_pipe()

    generator = torch.Generator(device=_DEVICE).manual_seed(seed)

    # רזולוציה מומלצת לליבה (אח"כ נעלה ל־4K אם ביקשו)
    base_height = 512
    base_width = 768

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt or None,
        height=base_height,
        width=base_width,
        num_frames=num_frames,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )

    frames: List[Image.Image] = result.frames[0]

    # upscale ל־רזולוציה המבוקשת (למשל 4K)
    if (width, height) != (base_width, base_height):
        frames = [f.resize((width, height), Image.BICUBIC) for f in frames]

    out_path = out_dir / f"ltx_{seed}.mp4"
    export_to_video(frames, str(out_path), fps=fps)

    return out_path

