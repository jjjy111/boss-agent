"""BOSS browser collection orchestration, filtering, persistence, and scheduling."""
from __future__ import annotations

import json
import re
import secrets
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from .db import Base, SessionLocal
from .models import Job

ROOT = Path(__file__).resolve().parents[1]
PROGRESS = ROOT / "data" / "boss_collection_progress.json"
EXTENSION = ROOT / "extension"
TOKEN_FILE = ROOT / "data" / "extension_token"
CITIES = (("杭州", "101210100", 1), ("宁波", "101210400", 2), ("上海", "101020100", 3))
INCOMPLETE_JD_PATTERN = re.compile(r"登录(?:后)?查看完整内容|登录可见|登录后可见")


class JobSourceMeta(Base):
    __tablename__ = "job_source_meta"
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), primary_key=True)
    source_name: Mapped[str] = mapped_column(String(40), default="BOSS直聘")
    experience: Mapped[str] = mapped_column(String(80), default="")
    education: Mapped[str] = mapped_column(String(80), default="")
    tags: Mapped[str] = mapped_column(Text, default="[]")
    city_priority: Mapped[int] = mapped_column(Integer, default=99)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CollectionRun(Base):
    __tablename__ = "collection_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(40), default="BOSS直聘")
    trigger: Mapped[str] = mapped_column(String(30), default="manual")
    status: Mapped[str] = mapped_column(String(30), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    discovered: Mapped[int] = mapped_column(Integer, default=0)
    accepted: Mapped[int] = mapped_column(Integer, default=0)
    new_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_count: Mapped[int] = mapped_column(Integer, default=0)
    archived_count: Mapped[int] = mapped_column(Integer, default=0)
    filtered_count: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default="")


class CollectionRequest(BaseModel):
    visible: bool = True


class ExtensionHeartbeat(BaseModel):
    version: str = ""
    logged_in: bool = False
    current_url: str = ""
    state: str = "idle"


class ExtensionProgress(BaseModel):
    run_id: int
    city: str = ""
    phase: str = ""
    found: int = 0
    complete_jd: int = 0
    message: str = ""
    jobs: list[dict] = Field(default_factory=list)


class ExtensionCompletion(BaseModel):
    run_id: int
    status: str
    complete: bool = False
    message: str = ""
    jobs: list[dict] = Field(default_factory=list)


_lock = threading.Lock()
_active_run_id: Optional[int] = None
_extension_state: dict = {
    "last_seen": None,
    "version": "",
    "logged_in": False,
    "current_url": "",
    "state": "offline",
}


def extension_token() -> str:
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        value = TOKEN_FILE.read_text("utf-8").strip()
        if value:
            return value
    value = secrets.token_urlsafe(32)
    TOKEN_FILE.write_text(value, "utf-8")
    try:
        TOKEN_FILE.chmod(0o600)
    except OSError:
        pass
    return value


def extension_authorized(value: str) -> bool:
    expected = extension_token()
    return bool(value) and secrets.compare_digest(value, expected)


def extension_status() -> dict:
    last_seen = _extension_state.get("last_seen")
    age = None if not last_seen else max(0, (datetime.utcnow() - last_seen).total_seconds())
    online = age is not None and age <= 45
    return {
        "online": online,
        "last_seen": last_seen.isoformat() if last_seen else None,
        "version": _extension_state.get("version", ""),
        "logged_in": bool(_extension_state.get("logged_in")) if online else False,
        "current_url": _extension_state.get("current_url", "") if online else "",
        "state": _extension_state.get("state", "offline") if online else "offline",
        "message": ("采集扩展已连接" if online else
                    "采集扩展离线，请在当前 Chrome 安装并启用扩展"),
    }


def record_extension_heartbeat(data: ExtensionHeartbeat) -> dict:
    _extension_state.update({
        "last_seen": datetime.utcnow(),
        "version": data.version[:40],
        "logged_in": bool(data.logged_in),
        "current_url": data.current_url[:1000],
        "state": data.state[:40],
    })
    return extension_status()


def open_extension_setup() -> dict:
    """Reveal the unpacked extension folder for installation in the current Chrome."""
    folder_opened = False
    if sys.platform == "darwin":
        try:
            subprocess.Popen(
                ["open", str(EXTENSION)], stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, start_new_session=True,
            )
            folder_opened = True
        except OSError:
            pass
    return {
        "opened": True,
        "folder_opened": folder_opened,
        "extension_path": str(EXTENSION),
        "message": (
            "已在 Finder 中打开采集器文件夹。请在当前 Chrome 地址栏输入 chrome://extensions/，开启“开发者模式”，点击“加载已解压的扩展程序”，选择这个 extension 文件夹。"
        ),
    }


def canonical_url(value: str) -> str:
    parts = urlsplit(value)
    return urlunsplit((parts.scheme or "https", parts.netloc or "www.zhipin.com", parts.path, "", ""))


def jd_is_complete(value: str) -> bool:
    text = str(value or "").strip()
    return bool(text) and not INCOMPLETE_JD_PATTERN.search(text)


def rejection_reason(item: dict) -> Optional[str]:
    title = str(item.get("title") or "").strip()
    jd = str(item.get("jd_content") or "")
    education = str(item.get("education") or "")
    experience = str(item.get("experience") or "")
    if not jd_is_complete(jd):
        return "JD未完整采集"
    if "运营" in title:
        return "运营岗位"
    if not re.search(r"产品|用户研究|需求分析", title, re.I):
        return "非目标产品岗位"
    mandatory_master = (
        education.strip() in {"硕士", "博士"}
        or re.search(r"(硕士|研究生)(及以上|以上学历|学历|学位|毕业)|全日制(硕士|研究生)|要求[^。；\n]{0,12}(硕士|研究生)", jd)
    )
    if mandatory_master and not re.search(r"硕士.{0,5}优先|本科.{0,8}硕士.{0,5}优先", jd):
        return "要求硕士及以上"
    if re.search(r"(?<![\d-])(?:[2-9]|10)\s*(?:年(?:以上|及以上)|\+\s*年)|至少\s*(?:[2-9]|10)\s*年|3-5年|5-10年|10年以上", experience):
        return "要求两年以上经验"
    if re.search(r"(?:至少|要求|具备|拥有)?[^。；\n]{0,8}(?:[2-9]|10)\s*(?:年(?:以上|及以上)|\+\s*年)[^。；\n]{0,12}(?:经验|经历)", jd):
        return "要求两年以上经验"
    return None


def match_score(item: dict) -> int:
    text = f"{item.get('title', '')} {item.get('jd_content', '')}".lower()
    score = 58
    score += 12 if "在校/应届" in str(item.get("experience")) else 0
    score += 12 if "实习" in str(item.get("title")) else 0
    score += sum(3 for word in ("需求", "用户", "竞品", "prd", "数据分析", "ai") if word in text)
    return min(98, score)


def _upsert(items: list[dict], complete: bool, db: Session) -> dict:
    now = datetime.utcnow()
    today = datetime.now().strftime("%Y-%m-%d")
    discovered, accepted, new_count, updated_count, filtered = len(items), 0, 0, 0, 0
    seen: set[str] = set()
    priority = {name: value for name, _, value in CITIES}
    for raw in items:
        reason = rejection_reason(raw)
        if reason:
            filtered += 1
            continue
        url = canonical_url(str(raw.get("source_url") or ""))
        if not url or "/job_detail/" not in url or url in seen:
            filtered += 1
            continue
        seen.add(url); accepted += 1
        job = db.query(Job).filter_by(source_url=url).first()
        if job is None:
            job = Job(source_url=url, batch_date=today,
                      company=str(raw.get("company") or "未知公司")[:160],
                      title=str(raw.get("title") or "未命名岗位")[:160])
            db.add(job); db.flush(); new_count += 1
        else:
            updated_count += 1
        job.company = str(raw.get("company") or "未知公司")[:160]
        job.title = str(raw.get("title") or "未命名岗位")[:160]
        job.location = str(raw.get("location") or "")[:120]
        job.salary = str(raw.get("salary") or "")[:80]
        job.jd_content = str(raw.get("jd_content") or "").strip()
        job.match_score = match_score(raw)
        job.is_valid = True
        meta = db.get(JobSourceMeta, job.id) or JobSourceMeta(job_id=job.id)
        meta.experience = str(raw.get("experience") or "")[:80]
        meta.education = str(raw.get("education") or "")[:80]
        meta.tags = json.dumps(raw.get("tags") or [], ensure_ascii=False)
        meta.city_priority = priority.get(str(raw.get("city") or ""), 99)
        meta.last_seen_at = now
        db.add(meta)
    archived = 0
    if complete:
        candidates = (db.query(Job).join(JobSourceMeta).filter(Job.is_valid.is_(True), JobSourceMeta.source_name == "BOSS直聘").all())
        for job in candidates:
            if job.source_url not in seen:
                job.is_valid = False; archived += 1
    db.commit()
    return {"discovered": discovered, "accepted": accepted, "new_count": new_count,
            "updated_count": updated_count, "filtered_count": filtered, "archived_count": archived}


def start_collection(visible: bool = True, trigger: str = "manual") -> int:
    global _active_run_id
    with _lock:
        db = SessionLocal()
        try:
            existing = (db.query(CollectionRun)
                        .filter(CollectionRun.status.in_(("queued", "running")))
                        .order_by(CollectionRun.id.desc()).first())
            if existing:
                _active_run_id = existing.id
                return existing.id
            run = CollectionRun(
                trigger=trigger,
                status="queued",
                message="已创建采集任务，等待当前 Chrome 中的扩展领取……",
            )
            db.add(run); db.commit(); db.refresh(run)
            _active_run_id = run.id
            return run.id
        finally:
            db.close()


def claim_extension_task() -> dict:
    global _active_run_id
    db = SessionLocal()
    try:
        run = (db.query(CollectionRun)
               .filter(CollectionRun.status.in_(("queued", "running")))
               .order_by(CollectionRun.id.asc()).first())
        if not run:
            return {"task": None}
        if run.status == "queued":
            run.status = "running"
            run.message = "Chrome 扩展已领取任务，正在检查 BOSS 登录状态……"
            db.commit()
        _active_run_id = run.id
        return {"task": {
            "run_id": run.id,
            "query": "产品",
            "cities": [{"name": name, "code": code} for name, code, _ in CITIES],
            "city_order": [name for name, _, _ in CITIES],
        }}
    finally:
        db.close()


def record_extension_progress(data: ExtensionProgress) -> dict:
    db = SessionLocal()
    try:
        run = db.get(CollectionRun, data.run_id)
        if not run or run.status not in {"queued", "running"}:
            raise RuntimeError("采集任务不存在或已结束")
        run.status = "running"
        run.message = data.message[:1000] or f"正在采集{data.city}"
        payload = data.model_dump()
        payload["updated_at"] = datetime.utcnow().isoformat()
        PROGRESS.write_text(json.dumps(payload, ensure_ascii=False), "utf-8")
        db.commit()
        return {"ok": True}
    finally:
        db.close()


def finish_extension_collection(data: ExtensionCompletion) -> dict:
    global _active_run_id
    db = SessionLocal()
    try:
        run = db.get(CollectionRun, data.run_id)
        if not run:
            raise RuntimeError("采集任务不存在")
        requested_success = data.status == "success" and data.complete and bool(data.jobs)
        if data.jobs:
            counts = _upsert(data.jobs, requested_success, db)
            for key, value in counts.items():
                setattr(run, key, value)
        if data.status in {"needs_login", "needs_verification"}:
            run.status = "needs_login"
        elif requested_success:
            run.status = "success"
        elif data.status == "partial" and data.jobs:
            run.status = "partial"
        else:
            run.status = "failed"
        run.message = (data.message or {
            "success": "杭州、宁波、上海岗位采集完成。",
            "partial": "本次采集部分完成，未归档旧岗位。",
        }.get(run.status, "本次采集未完成。"))[:1000]
        run.finished_at = datetime.utcnow()
        db.commit()
        return {"ok": True, "status": run.status}
    finally:
        db.close()
        with _lock:
            if _active_run_id == data.run_id:
                _active_run_id = None


def latest_status(db: Session) -> dict:
    run = db.query(CollectionRun).order_by(CollectionRun.id.desc()).first()
    progress = None
    if run and run.status in {"queued", "running"} and PROGRESS.exists():
        try:
            progress = json.loads(PROGRESS.read_text("utf-8"))
            if progress.get("run_id") != run.id:
                progress = None
            else:
                progress.pop("jobs", None)
        except (OSError, ValueError): pass
    run_data = None if not run else {key: value for key, value in run.__dict__.items() if key != "_sa_instance_state"}
    return {"running": bool(run and run.status in {"queued", "running"}), "run": run_data,
            "progress": progress, "extension": extension_status(),
            "city_order": [name for name, _, _ in CITIES]}


def recover_interrupted_runs() -> None:
    """Mark runs interrupted by a server restart so the button is usable again."""
    db = SessionLocal()
    try:
        interrupted = db.query(CollectionRun).filter_by(status="running").all()
        progress = None
        if PROGRESS.exists():
            try: progress = json.loads(PROGRESS.read_text("utf-8"))
            except (OSError, ValueError): pass
        for run in interrupted:
            if progress and progress.get("run_id") == run.id and progress.get("jobs"):
                counts = _upsert(progress["jobs"], False, db)
                for key, value in counts.items(): setattr(run, key, value)
                run.status, run.message = "partial", "上次采集被中断；已保留中断前读取的岗位，未归档任何旧岗位。"
            else:
                run.status, run.message = "failed", "上次采集因服务退出而中断，请重新执行。"
            run.finished_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()
