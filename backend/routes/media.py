import uuid, os, shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/media", tags=["media"])

MEDIA_DIR   = Path(__file__).parent.parent.parent / "data" / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VIDEO = {".mp4", ".webm", ".mov", ".m4v"}
ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE_MB   = 100


def _try_cloudinary(local_path: str, resource_type: str) -> str | None:
    """Upload file to Cloudinary CDN. Returns secure URL, or None if not configured."""
    if not os.getenv("CLOUDINARY_API_KEY"):
        return None
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", ""),
            api_key    = os.getenv("CLOUDINARY_API_KEY", ""),
            api_secret = os.getenv("CLOUDINARY_API_SECRET", ""),
            secure     = True,
        )
        result = cloudinary.uploader.upload(
            local_path,
            resource_type = resource_type,
            public_id     = f"cogit_uploads/{uuid.uuid4().hex}",
            overwrite     = False,
        )
        cdn_url = result.get("secure_url")
        print(f"[Cloudinary] upload ok → {cdn_url}")
        return cdn_url
    except Exception as e:
        print(f"[Cloudinary] upload failed: {e}")
        return None


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO | ALLOWED_IMAGE:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    media_type = "video" if ext in ALLOWED_VIDEO else "image"

    # Write upload to a temp path first (stream, enforcing size limit)
    tmp_path = MEDIA_DIR / f"tmp_{uuid.uuid4().hex}{ext}"
    size = 0
    try:
        with open(tmp_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_SIZE_MB * 1024 * 1024:
                    raise HTTPException(413, f"File too large (max {MAX_SIZE_MB} MB)")
                f.write(chunk)

        # ── Cloudinary path ──────────────────────────────────────────────
        cdn_url = _try_cloudinary(str(tmp_path), resource_type=media_type)
        if cdn_url:
            tmp_path.unlink(missing_ok=True)
            return {
                "url":        cdn_url,
                "filename":   Path(cdn_url).name,
                "media_type": media_type,
                "size_bytes": size,
            }

        # ── Local fallback (dev / Cloudinary not configured) ─────────────
        filename  = f"{uuid.uuid4().hex}{ext}"
        dest_path = MEDIA_DIR / filename
        shutil.move(str(tmp_path), str(dest_path))
        return {
            "url":        f"/media/{filename}",
            "filename":   filename,
            "media_type": media_type,
            "size_bytes": size,
        }

    except HTTPException:
        tmp_path.unlink(missing_ok=True)
        raise
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(500, str(e))
