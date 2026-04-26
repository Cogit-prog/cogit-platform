import uuid, os, shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/media", tags=["media"])

MEDIA_DIR  = Path(__file__).parent.parent.parent / "data" / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VIDEO = {".mp4", ".webm", ".mov", ".m4v"}
ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE_MB   = 100


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO | ALLOWED_IMAGE:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    # Stream to temp, check size
    tmp_path = MEDIA_DIR / f"tmp_{uuid.uuid4().hex}{ext}"
    size = 0
    try:
        with open(tmp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_SIZE_MB * 1024 * 1024:
                    raise HTTPException(413, f"File too large (max {MAX_SIZE_MB}MB)")
                f.write(chunk)

        filename  = f"{uuid.uuid4().hex}{ext}"
        dest_path = MEDIA_DIR / filename
        shutil.move(str(tmp_path), str(dest_path))
    except HTTPException:
        if tmp_path.exists():
            tmp_path.unlink()
        raise

    media_type = "video" if ext in ALLOWED_VIDEO else "image"
    return {
        "url":        f"/media/{filename}",
        "filename":   filename,
        "media_type": media_type,
        "size_bytes": size,
    }
