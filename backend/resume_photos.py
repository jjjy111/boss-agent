"""Local, version-bound resume photo storage and artifact invalidation."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path
from shutil import copyfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from .db import get_db
from .models import Application, ResumeVersion, TailoredResume


ROOT = Path(__file__).resolve().parents[1]
PHOTO_DIR = ROOT / "data" / "resume_photos"
GENERATED_DIR = ROOT / "data" / "generated_resumes"
PHOTO_DIR.mkdir(parents=True, exist_ok=True)
MAX_PHOTO_BYTES = 12 * 1024 * 1024
router = APIRouter(prefix="/api/resumes")


def photo_path(resume_id: int) -> Path:
    return PHOTO_DIR / f"resume_{resume_id}.jpg"


def invalidate_unsent_artifacts(db: Session, resume_id: int) -> int:
    """Require re-export when source content/photo changed, preserving sent history."""
    count = 0
    rows = db.query(TailoredResume).filter_by(source_resume_id=resume_id).all()
    for tailored in rows:
        application = db.query(Application).filter_by(tailored_resume_id=tailored.id).first()
        if application and application.status == "已发送简历":
            continue
        for suffix in ("png", "pdf"):
            artifact = GENERATED_DIR / f"tailored_resume_{tailored.id}.{suffix}"
            if artifact.exists():
                artifact.unlink()
        if tailored.status in {"pdf_ready", "pdf_confirmed", "final"}:
            tailored.status = "draft"
        if application:
            application.status = "待重新确认"
            application.feedback = "通用简历照片已更新，请重新导出并确认最终材料。"
        count += 1
    return count


def save_photo(db: Session, resume: ResumeVersion, data: bytes) -> dict:
    if not data or len(data) > MAX_PHOTO_BYTES:
        raise ValueError("照片为空或超过 12 MB")
    try:
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("照片无法识别，请使用 JPG、PNG 或 WebP") from exc
    if image.width < 300 or image.height < 400:
        raise ValueError("照片清晰度不足，至少需要 300×400 像素")
    image.thumbnail((1600, 2000), Image.Resampling.LANCZOS)
    output = photo_path(resume.id)
    temporary = output.with_suffix(".jpg.tmp")
    image.save(temporary, "JPEG", quality=90, optimize=True)
    temporary.replace(output)
    resume.photo_updated_at = datetime.utcnow()
    invalidated = invalidate_unsent_artifacts(db, resume.id)
    db.commit()
    return {
        "ready": True,
        "resume_id": resume.id,
        "width": image.width,
        "height": image.height,
        "updated_at": resume.photo_updated_at,
        "url": f"/api/resumes/{resume.id}/photo?v={int(resume.photo_updated_at.timestamp())}",
        "invalidated_tailored_resumes": invalidated,
    }


def copy_resume_photo(db: Session, source_id: int, target: ResumeVersion) -> bool:
    source = db.get(ResumeVersion, source_id)
    image = photo_path(source_id)
    if not source or not image.exists():
        return False
    copyfile(image, photo_path(target.id))
    target.photo_updated_at = datetime.utcnow()
    return True


@router.post("/{resume_id}/photo")
async def upload_resume_photo(resume_id: int, file: UploadFile = File(...),
                              db: Session = Depends(get_db)):
    resume = db.get(ResumeVersion, resume_id)
    if not resume:
        raise HTTPException(404, "简历版本不存在")
    try:
        return save_photo(db, resume, await file.read())
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.get("/{resume_id}/photo")
def get_resume_photo(resume_id: int, db: Session = Depends(get_db)):
    resume = db.get(ResumeVersion, resume_id)
    image = photo_path(resume_id)
    if not resume or not image.exists():
        raise HTTPException(404, "该通用简历尚未绑定投递照片")
    return FileResponse(image, media_type="image/jpeg", filename=f"resume_photo_{resume_id}.jpg")


@router.delete("/{resume_id}/photo")
def delete_resume_photo(resume_id: int, db: Session = Depends(get_db)):
    resume = db.get(ResumeVersion, resume_id)
    if not resume:
        raise HTTPException(404, "简历版本不存在")
    image = photo_path(resume_id)
    if image.exists():
        image.unlink()
    resume.photo_updated_at = None
    invalidated = invalidate_unsent_artifacts(db, resume.id)
    db.commit()
    return {"deleted": True, "invalidated_tailored_resumes": invalidated}
