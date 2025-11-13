from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import tempfile
import base64


app = FastAPI(title="KRSTUDIO LTX GPU SERVER")


class GenRequest(BaseModel):
    prompt: str
    num_frames: int = 49
    fps: int = 24
    height: int = 512
    width: int = 512


@app.post("/generate")
def generate_video(body: GenRequest):
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        tmp_path = tmp.name
        tmp.close()

        with open(tmp_path, "wb") as f:
            f.write(b"FAKE_MP4_FOR_TEST")

        with open(tmp_path, "rb") as f:
            b = f.read()

        b64 = base64.b64encode(b).decode("utf-8")
        return {
            "success": True,
            "video": f"data:video/mp4;base64,{b64}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

