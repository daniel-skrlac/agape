from fastapi import FastAPI, File, HTTPException, UploadFile

from app.analyzer import analyze_dispatch_slip

app = FastAPI(title="Dispatch Slip Analyzer", version="2.0.0")


@app.get("/health")
def health():
    return {"status": "UP"}


@app.post("/analyze-dispatch-slip")
async def analyze_dispatch_slip_endpoint(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()

    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")

    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="File is empty.")

    try:
        return analyze_dispatch_slip(data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze dispatch slip: {exc}")
