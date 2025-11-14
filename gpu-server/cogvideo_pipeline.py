# FILE: gpu-server/cogvideo_pipeline.py
import os
from pathlib import Path
from typing import List
import torch
from diffusers import CogVideoXPipeline
from diffusers.utils import export_to_video
from PIL import Image

_COG_PIPE = None
_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# אפשר להחליף ל-THUDM/CogVideoX-5b אם יש לך מספיק VRAM
COG_MODEL_ID = os.environ.get("COG_MODEL_ID", "THUDM/CogVideoX-2b")


def get_cog_pipe() -> CogVideoXPipeline:
    global _COG_PIPE
    if _COG_PIPE is None:
        _COG_PIPE = CogVideoXPipeline.from_pretrained(
            COG_MODEL_ID,
            torch_dtype=torch.float16,
        )
        _COG_PIPE.to(_DEVICE)
        # _COG_PIPE.enable_sequential_cpu_offload() # אם צריך לחסוך זיכרון
    return _COG_PIPE


def generate_cogvideo_video(
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
    pipe = get_cog_pipe()

    generator = torch.Generator(device=_DEVICE).manual_seed(seed)

    # רזולוציה מומלצת (אח"כ upscale ל־4K לפי הצורך)
    base_height = 480
    base_width = 768

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt or None,
        height=base_height,
        width=base_width,
        num_frames=num_frames,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        use_dynamic_cfg=True,
        generator=generator,
    )

    frames: List[Image.Image] = result.frames[0]

    if (width, height) != (base_width, base_height):
        frames = [f.resize((width, height), Image.BICUBIC) for f in frames]

    out_path = out_dir / f"cog_{seed}.mp4"
    export_to_video(frames, str(out_path), fps=fps)
    return out_path

