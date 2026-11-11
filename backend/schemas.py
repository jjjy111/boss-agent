from datetime import datetime
from pydantic import BaseModel

class JobCreate(BaseModel):
    company: str
    title: str
    location: str = "杭州"
    salary: str = ""
    jd_content: str = ""
    source_url: str = ""
    batch_date: str

class ResumeUpdate(BaseModel):
    content: str

class TailorRequest(BaseModel):
    resume_id: int

class TailorUpdate(BaseModel):
    content: str
