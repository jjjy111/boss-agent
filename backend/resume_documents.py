"""Versioned formatter state. Keep layout and content together, retaining revisions."""
import hashlib
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, Session
from .db import Base, get_db
from .models import ResumeVersion


class ResumeDocumentRevision(Base):
    __tablename__ = "resume_document_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resume_versions.id"))
    content: Mapped[str] = mapped_column(Text)
    formatter_state: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DocumentSave(BaseModel):
    content: str = Field(min_length=1, max_length=200000)
    formatter_state: dict
    expected_hash: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    source_resume_id: Optional[int] = None


class DeletedResume(Base):
    """A recoverable removal; historical tailored resumes keep their source."""
    __tablename__ = "deleted_resume_versions"
    resume_id: Mapped[int] = mapped_column(ForeignKey("resume_versions.id"), primary_key=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


router = APIRouter(prefix="/api/resume-documents")


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def result(item, revision=None):
    return {"id": item.id, "name": item.name, "content": item.content,
            "content_hash": digest(item.content + item.name + (revision.formatter_state or "" if revision else "")),
            "formatter_state": json.loads(revision.formatter_state)
            if revision and revision.formatter_state else None}


def validate_document(data):
    state = data.formatter_state
    if not isinstance(state.get("profile"), dict) or not isinstance(state.get("sections"), list):
        raise HTTPException(422, "简历缺少个人信息或板块结构")
    if len(json.dumps(state, ensure_ascii=False)) > 12000000:
        raise HTTPException(413, "简历或照片过大，请压缩照片后重试")


@router.get("/{resume_id}")
def get_document(resume_id: int, db: Session = Depends(get_db)):
    item = db.get(ResumeVersion, resume_id)
    if not item or db.get(DeletedResume, resume_id):
        raise HTTPException(404, "简历版本不存在")
    revision = db.query(ResumeDocumentRevision).filter_by(resume_id=resume_id).order_by(ResumeDocumentRevision.id.desc()).first()
    if revision and revision.content != item.content:
        revision = None
    return result(item, revision)


@router.put("/{resume_id}")
def save_document(resume_id: int, data: DocumentSave, db: Session = Depends(get_db)):
    validate_document(data)
    item = db.get(ResumeVersion, resume_id)
    if not item or db.get(DeletedResume, resume_id):
        raise HTTPException(404, "简历版本不存在")
    if data.expected_hash and data.expected_hash != get_document(resume_id, db)["content_hash"]:
        raise HTTPException(409, "此版本已在其他页面更新，请重新打开后编辑")
    # Preserve the pre-formatter source before the first save.
    if not db.query(ResumeDocumentRevision).filter_by(resume_id=resume_id).first():
        db.add(ResumeDocumentRevision(resume_id=resume_id, content=item.content))
    item.content = data.content
    if data.name is not None:
        item.name = data.name.strip() or item.name
    revision = ResumeDocumentRevision(resume_id=item.id, content=data.content,
        formatter_state=json.dumps(data.formatter_state, ensure_ascii=False))
    db.add(revision)
    db.commit()
    db.refresh(item)
    db.refresh(revision)
    return result(item, revision)


@router.delete("/{resume_id}")
def delete_document(resume_id: int, db: Session = Depends(get_db)):
    item = db.get(ResumeVersion, resume_id)
    if not item:
        raise HTTPException(404, "简历版本不存在")
    if not db.get(DeletedResume, resume_id):
        db.add(DeletedResume(resume_id=resume_id))
        db.flush()
    if item.is_current:
        item.is_current = False
        replacement = db.query(ResumeVersion).filter(~ResumeVersion.id.in_(db.query(DeletedResume.resume_id))).order_by(ResumeVersion.created_at.desc()).first()
        if replacement:
            replacement.is_current = True
    db.commit()
    return {"deleted": True, "recoverable": True, "id": resume_id}


@router.post("/{resume_id}/restore")
def restore_document(resume_id: int, db: Session = Depends(get_db)):
    item = db.get(ResumeVersion, resume_id)
    if not item:
        raise HTTPException(404, "简历版本不存在")
    deleted = db.get(DeletedResume, resume_id)
    if deleted:
        db.delete(deleted)
    if not db.query(ResumeVersion).filter_by(is_current=True).first():
        item.is_current = True
    db.commit()
    return {"restored": True, "id": resume_id}


@router.post("")
def create_document(data: DocumentSave, db: Session = Depends(get_db)):
    validate_document(data)
    if not data.name or not data.name.strip():
        raise HTTPException(422, "请填写简历版本名称")
    item = ResumeVersion(name=data.name.strip(), content=data.content,
                         is_current=db.query(ResumeVersion).filter_by(is_current=True).count() == 0)
    db.add(item)
    db.flush()
    if data.source_resume_id:
        from .resume_photos import copy_resume_photo
        copy_resume_photo(db, data.source_resume_id, item)
    revision = ResumeDocumentRevision(resume_id=item.id, content=data.content,
        formatter_state=json.dumps(data.formatter_state, ensure_ascii=False))
    db.add(revision)
    db.commit()
    db.refresh(item)
    db.refresh(revision)
    return result(item, revision)
