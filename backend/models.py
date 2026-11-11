from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

class ResumeVersion(Base):
    __tablename__ = "resume_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(160))
    location: Mapped[str] = mapped_column(String(120), default="杭州")
    salary: Mapped[str] = mapped_column(String(80), default="")
    jd_content: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    batch_date: Mapped[str] = mapped_column(String(20))
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    match_score: Mapped[int] = mapped_column(Integer, default=0)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)

class TailoredResume(Base):
    __tablename__ = "tailored_resumes"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    source_resume_id: Mapped[int] = mapped_column(ForeignKey("resume_versions.id"))
    content: Mapped[str] = mapped_column(Text, default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[str] = mapped_column(Text, default="[]")
    risks: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    changes_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
