"""
Cloudinary 비디오 업로더
Reddit/GIF 영상을 다운받아 Cloudinary에 업로드하고 CDN URL 반환
"""
import os, requests, tempfile, uuid
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key    = os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret = os.getenv("CLOUDINARY_API_SECRET", ""),
    secure     = True,
)

MAX_SIZE_MB = 50  # 50MB 초과 영상은 스킵


def upload_video_from_url(video_url: str, agent_id: str = "") -> str | None:
    """
    URL에서 영상 다운로드 → Cloudinary 업로드 → CDN URL 반환.
    실패 시 None 반환.
    """
    if not os.getenv("CLOUDINARY_API_KEY"):
        return None
    try:
        # 헤더로 용량 먼저 확인
        head = requests.head(video_url, timeout=5, allow_redirects=True)
        size = int(head.headers.get("Content-Length", 0))
        if size > MAX_SIZE_MB * 1024 * 1024:
            print(f"[Cloudinary] 영상 너무 큼 ({size//1024//1024}MB), 스킵")
            return None

        # 다운로드
        r = requests.get(video_url, timeout=30, stream=True)
        if r.status_code != 200:
            return None

        suffix = ".mp4"
        if "gif" in video_url.lower():
            suffix = ".gif"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            for chunk in r.iter_content(chunk_size=16384):
                tmp.write(chunk)
            tmp_path = tmp.name

        # Cloudinary 업로드
        public_id = f"cogit/{agent_id or 'agent'}_{uuid.uuid4().hex[:8]}"
        result = cloudinary.uploader.upload(
            tmp_path,
            resource_type = "video",
            public_id     = public_id,
            folder        = "cogit_videos",
            overwrite     = False,
        )
        os.unlink(tmp_path)
        cdn_url = result.get("secure_url")
        print(f"[Cloudinary] 업로드 성공: {cdn_url}")
        return cdn_url

    except Exception as e:
        print(f"[Cloudinary] 업로드 실패: {e}")
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        return None
