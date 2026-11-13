import json
from pathlib import Path
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from .db import Base, SessionLocal, engine, get_db
from .models import Job
from .schemas import JobCreate
from .collection import (CollectionRequest, ExtensionCompletion, ExtensionHeartbeat,
                         ExtensionProgress, JobSourceMeta,
                         claim_extension_task, extension_authorized, extension_status,
                         extension_token, finish_extension_collection, jd_is_complete,
                         latest_status, open_extension_setup,
                         record_extension_heartbeat,
                         record_extension_progress, start_collection,
                         recover_interrupted_runs)

Base.metadata.create_all(bind=engine)

def migrate_local_schema():
    """Apply tiny additive migrations for existing local SQLite databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    tailored_columns = ({column["name"] for column in inspector.get_columns("tailored_resumes")}
                        if "tailored_resumes" in tables else set())
    if "changes_confirmed" not in tailored_columns:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE tailored_resumes "
                "ADD COLUMN changes_confirmed BOOLEAN NOT NULL DEFAULT 0"
            ))

    resume_columns = ({column["name"] for column in inspect(engine).get_columns("resume_versions")}
                      if "resume_versions" in tables else set())
    if "photo_updated_at" not in resume_columns:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE resume_versions ADD COLUMN photo_updated_at DATETIME"
            ))

migrate_local_schema()
app = FastAPI(title="BOSS - Agent MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Collector-Token"],
)
FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

@app.on_event("startup")
def startup():
    recover_interrupted_runs()

@app.get("/")
def index(): return FileResponse(FRONTEND / "index.html")

@app.get("/api/jobs")
def jobs(db: Session = Depends(get_db)):
    rows = []
    for job in db.query(Job).order_by(Job.batch_date.desc(), Job.id.desc()).all():
        meta = db.get(JobSourceMeta, job.id)
        if meta and meta.source_name == "BOSS直聘" and not jd_is_complete(job.jd_content):
            continue
        row = {key: value for key, value in job.__dict__.items() if key != "_sa_instance_state"}
        row.update({"source_name": meta.source_name if meta else "示例数据",
                    "experience": meta.experience if meta else "", "education": meta.education if meta else "",
                    "tags": json.loads(meta.tags) if meta else [], "city_priority": meta.city_priority if meta else 99})
        rows.append(row)
    rows.sort(key=lambda row: (0 if row["is_valid"] else 1, row["city_priority"], -row["id"]))
    return rows

@app.get("/api/collection/status")
def collection_status(db: Session = Depends(get_db)):
    return latest_status(db)

def require_collector(x_collector_token: str = Header(default="")) -> None:
    if not extension_authorized(x_collector_token):
        raise HTTPException(401, "采集扩展认证失败")


@app.get("/api/collector/bootstrap")
def collector_bootstrap(request: Request):
    if not request.client or request.client.host not in {"127.0.0.1", "::1", "testclient"}:
        raise HTTPException(403, "仅允许本机扩展连接")
    return {"token": extension_token(), "poll_seconds": 10}


@app.get("/api/collector/status")
def collector_status():
    return extension_status()


@app.post("/api/collector/heartbeat")
def collector_heartbeat(data: ExtensionHeartbeat, _: None = Depends(require_collector)):
    return record_extension_heartbeat(data)


@app.get("/api/collector/tasks/next")
def collector_next_task(_: None = Depends(require_collector)):
    return claim_extension_task()


@app.post("/api/collector/runs/{run_id}/progress")
def collector_progress(run_id: int, data: ExtensionProgress,
                       _: None = Depends(require_collector)):
    if run_id != data.run_id:
        raise HTTPException(400, "采集任务 ID 不一致")
    try:
        return record_extension_progress(data)
    except RuntimeError as exc:
        raise HTTPException(409, str(exc))


@app.post("/api/collector/runs/{run_id}/complete")
def collector_complete(run_id: int, data: ExtensionCompletion,
                       _: None = Depends(require_collector)):
    if run_id != data.run_id:
        raise HTTPException(400, "采集任务 ID 不一致")
    try:
        return finish_extension_collection(data)
    except RuntimeError as exc:
        raise HTTPException(409, str(exc))

@app.post("/api/collection/open-extension-setup")
def collection_open_extension_setup():
    try:
        return open_extension_setup()
    except RuntimeError as exc:
        raise HTTPException(409, str(exc))

@app.post("/api/collection/start")
def collect_now(data: CollectionRequest):
    return {"run_id": start_collection(data.visible, "manual")}

@app.post("/api/jobs")
def create_job(item: JobCreate, db: Session = Depends(get_db)):
    if "运营" in item.title and "产品" not in item.title: raise HTTPException(400, "已排除运营岗位")
    job = Job(**item.model_dump(), match_score=60)
    db.add(job); db.commit(); db.refresh(job); return job

@app.patch("/api/jobs/{job_id}")
def update_job(job_id: int, data: dict, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job: raise HTTPException(404, "岗位不存在")
    for key in ("is_read", "is_favorite", "is_valid"):
        if key in data: setattr(job, key, bool(data[key]))
    db.commit(); return job

