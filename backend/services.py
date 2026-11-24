import json
import re
from datetime import datetime
from pathlib import Path
from html import escape
from sqlalchemy.orm import Session
from .models import Job, ResumeVersion, TailoredResume
from .deepseek import DeepSeekClient

GENERATED_RESUME_DIR = Path(__file__).resolve().parents[1] / "data" / "generated_resumes"
GENERATED_RESUME_DIR.mkdir(parents=True, exist_ok=True)

def analyze_job(job: Job, resume: ResumeVersion, client=None, job_context=None) -> TailoredResume:
    """Generate a full, structured draft with DeepSeek and no rule fallback."""
    if not resume.content.strip():
        raise ValueError("通用简历内容为空，请先在简历排版器中补充并保存。")
    result = (client or DeepSeekClient.from_env()).tailor(job, resume, job_context)
    reason = json.dumps({
        "summary": result.summary,
        "job_requirements": result.job_requirements.model_dump(),
        "changes": [item.model_dump() for item in result.changes],
    }, ensure_ascii=False)
    keywords = json.dumps([item.model_dump() for item in result.keyword_coverage], ensure_ascii=False)
    risks = json.dumps(result.risks, ensure_ascii=False)
    return TailoredResume(
        job_id=job.id,
        source_resume_id=resume.id,
        content=result.content,
        reason=reason,
        keywords=keywords,
        risks=risks,
        status="draft",
    )

def extract_resume_text(data: bytes) -> str:
    from io import BytesIO
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()

def archive_absent_jobs(db: Session, seen_source_urls: set[str]) -> int:
    """归档一次完整 BOSS 扫描中已不再出现的有效岗位。

    仅在采集器成功完成全量搜索页扫描后调用，避免因单页加载失败误归档。
    """
    jobs = db.query(Job).filter(Job.is_valid.is_(True)).all()
    closed = [job for job in jobs if job.source_url and job.source_url not in seen_source_urls]
    for job in closed:
        job.is_valid = False
    db.commit()
    return len(closed)

def render_tailored_pdf(item: TailoredResume) -> Path:
    """Render the currently saved tailored-resume text as an A4 PDF."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    font_path = "/System/Library/Fonts/STHeiti Medium.ttc"
    pdfmetrics.registerFont(TTFont("STHeiti", font_path, subfontIndex=0))
    output = GENERATED_RESUME_DIR / f"tailored_resume_{item.id}.pdf"
    page_width, page_height = A4
    margin_x, margin_y = 18 * mm, 16 * mm
    font_size, leading = 10.5, 17
    c = canvas.Canvas(str(output), pagesize=A4)
    c.setFont("STHeiti", font_size)
    y = page_height - margin_y
    max_width = page_width - 2 * margin_x

    def wrapped(line: str):
        if not line:
            return [""]
        rows, current = [], ""
        for char in line:
            if pdfmetrics.stringWidth(current + char, "STHeiti", font_size) > max_width and current:
                rows.append(current)
                current = char
            else:
                current += char
        rows.append(current)
        return rows

    for raw_line in item.content.splitlines():
        for line in wrapped(raw_line):
            if y < margin_y:
                c.showPage()
                c.setFont("STHeiti", font_size)
                y = page_height - margin_y
            c.drawString(margin_x, y, line)
            y -= leading
        if not raw_line:
            y -= leading * 0.35
    c.save()
    return output

def seed_jobs(db: Session):
    if db.query(Job).count():
        return
    examples = [
        ("示例科技", "AI 产品经理", "15-25K", "负责 AI 产品需求分析、用户场景梳理、竞品分析和跨部门推进。"),
        ("示例电商", "产品经理（B 端）", "12-20K", "负责商家产品规划、数据分析、PRD 撰写和业务流程优化。"),
    ]
    for index, (company, title, salary, jd) in enumerate(examples):
        db.add(Job(company=company, title=title, salary=salary, jd_content=jd,
                   batch_date=datetime.now().strftime("%Y-%m-%d"), source_url="https://www.zhipin.com/",
                   match_score=78 - index * 4))
    db.commit()
