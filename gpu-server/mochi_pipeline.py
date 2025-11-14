# FILE: gpu-server/mochi_pipeline.py
import os
from pathlib import Path
import time
import random
import numpy as np

from PIL import Image
import imageio.v3 as iio

# נניח שיש לך ENV בשם MOCHI_MODEL_DIR שמצביע לתיקיית המודל
MOCHI_MODEL_DIR = os.environ.get("MOCHI_MODEL_DIR", "/workspace/mochi_weights")
MOCHI_CPU_OFFLOAD = True  # טוב ל־GPU בודד

_configured = False
_mochi_module = None

def _ensure_configured():
    global _configured, _mochi_module
    if _configured:
        return
    
    try:
        # נסה לייבא את mochi
        from mochi.demos.cli import configure_model, generate_video as mochi_generate_video
        _mochi_module = {
            'configure_model': configure_model,
            'generate_video': mochi_generate_video
        }
        
        # ל־Mochi CLI יש פונקציה configure_model
        configure_model(
            model_dir_path_=MOCHI_MODEL_DIR,
            lora_path_=None,
            cpu_offload_=MOCHI_CPU_OFFLOAD,
        )
        _configured = True
    except ImportError as e:
        raise ImportError(
            f"Mochi not installed. Please install it with: "
            f"cd gpu-server && git clone https://github.com/genmoai/mochi.git && "
            f"cd mochi && pip install -e . --no-build-isolation"
        ) from e


def generate_mochi_video(
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
    _ensure_configured()
    out_dir.mkdir(parents=True, exist_ok=True)

    # רזולוציה בסיסית של Mochi (16:9)
    base_width = 848
    base_height = 480

    mochi_generate_video = _mochi_module['generate_video']
    
    out_path = mochi_generate_video(
        prompt=prompt,
        negative_prompt=negative_prompt or "",
        width=base_width,
        height=base_height,
        num_frames=num_frames,
        seed=seed,
        cfg_scale=guidance_scale,
        num_inference_steps=num_inference_steps,
        output_dir=str(out_dir),
    )

    # אם רוצים 4K – נבצע upscale
    if (width, height) != (base_width, base_height):
        # נטען את הווידאו, נגדיל פריים פריים, ונשמור מחדש
        video = iio.imread(out_path)  # shape: (T, H, W, C)
        frames = [Image.fromarray(frame).resize((width, height), Image.BICUBIC)
                  for frame in video]
        out_path_up = out_dir / f"mochi_{seed}.mp4"
        iio.imwrite(out_path_up, np.stack([np.array(f) for f in frames]), fps=fps)
        return out_path_up

    return Path(out_path)

