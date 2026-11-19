"""Seed the local database with fictional demo data.

Everything here is invented (companies, people, contact details) so the workbench has
something to render after a reset. Run from the project root:

    .venv/bin/python scripts/seed_demo_data.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.db import Base, SessionLocal, engine  # noqa: E402
from backend.models import Job, ResumeVersion, TailoredResume  # noqa: E402
from backend.collection import CollectionRun  # noqa: E402


DEMO_RESUME = """林知夏
138-0000-0000 | demo.product@example.com | 杭州
教育背景
华东理工大学 信息管理与信息系统｜本科 2022.09–2026.06
GPA 3.6/4.0；校级一等奖学金；主修课程：数据分析、产品设计、用户研究、数据库原理
实习经历
云帆科技 产品实习生 2025.07–2025.12
- 负责企业协作工具的权限模块需求，完成 12 份用户访谈与竞品拆解
- 推动「批量导入」需求上线，导入耗时从 6 分钟降至 40 秒
- 搭建需求看板，把需求平均确认周期从 5 天压到 2 天
星野文创 运营实习生 2025.01–2025.05
- 维护内容排期表，支持 3 个栏目每周 9 篇更新
- 整理 200+ 条用户反馈，输出标签体系供选题使用
项目经历
校园二手交易小程序 产品负责人 2025.03–2025.06
- 从 0 到 1 完成需求梳理、原型和验收，累计注册 1200 人
- 设计信用分规则，纠纷率下降 35%
技能特长
Axure / Figma / SQL / Python 基础 / 需求文档 / 用户访谈
"""

DEMO_RESUME_DATA = """林知夏
138-0000-0000 | demo.data@example.com | 杭州
教育背景
华东理工大学 信息管理与信息系统｜本科 2022.09–2026.06
GPA 3.6/4.0；主修课程：统计学、数据可视化、数据库原理、机器学习导论
实习经历
云帆科技 数据产品实习生 2025.07–2025.12
- 搭建权限模块的使用埋点，形成 9 张核心指标看板
- 通过漏斗分析定位导入失败原因，失败率从 12% 降到 3%
项目经历
校园二手交易小程序 数据分析 2025.03–2025.06
- 设计留存与转化指标体系，输出每周数据周报
技能特长
SQL / Python / Tableau / 指标体系 / A/B 测试
"""

JOBS = [
    dict(company="星澜科技", title="AI 产品经理", location="杭州", salary="18-28K",
         match_score=78, is_read=False,
         jd_content="负责 AI 助手类产品的需求分析与路线规划，梳理用户场景与竞品，"
                    "协同算法与研发推进版本落地；要求 1-3 年产品经验，能独立撰写 PRD。"),
    dict(company="拾光网络", title="产品助理", location="杭州", salary="8-12K",
         match_score=62, is_read=True,
         jd_content="协助产品经理完成需求收集、原型绘制与文档整理，跟进版本验收与线上反馈；"
                    "要求熟练使用 Axure/Figma，沟通细致。"),
    dict(company="海隅数据", title="数据产品经理", location="宁波", salary="15-22K",
         match_score=71, is_read=False,
         jd_content="负责数据看板与指标平台的产品设计，梳理业务口径，推动数据质量治理；"
                    "要求熟悉 SQL，有指标体系搭建经验。"),
    dict(company="云樾教育", title="产品运营", location="上海", salary="10-16K",
         match_score=55, is_read=True,
         jd_content="负责课程产品的活动策划与用户增长，维护内容排期，分析转化数据并复盘；"
                    "要求有内容运营或活动运营经验。"),
    dict(company="未名智能", title="B 端产品经理", location="上海", salary="20-30K",
         match_score=83, is_read=False,
         jd_content="负责企业协作平台的权限与工作流模块，完成从调研、方案到上线的闭环；"
                    "要求 2 年以上 B 端产品经验，熟悉权限模型。"),
    dict(company="北岸出行", title="产品经理", location="杭州", salary="14-20K",
         match_score=48, is_read=True, is_valid=False,
         jd_content="负责出行 App 的订单与履约流程优化，跟进线上问题与版本节奏。"
                    "（该岗位在最近一次采集中已下线）"),
]

KEYWORDS = [
    {"keyword": "需求分析", "covered": True, "evidence": "12 份用户访谈与竞品拆解"},
    {"keyword": "PRD", "covered": True, "evidence": "权限模块需求文档"},
    {"keyword": "AI 产品", "covered": True, "inferred": True,
     "evidence": "协作工具中接入智能摘要的需求", "explanation": "属于相近场景的迁移，非直接 AI 产品经历"},
    {"keyword": "数据分析", "covered": True, "evidence": "导入耗时、失败率等指标口径"},
    {"keyword": "跨部门协作", "covered": True, "evidence": "与算法、研发、测试推进版本落地"},
]

REASON = {
    "summary": "围绕岗位要求的「需求分析 + AI 场景 + 跨部门推进」重排了实习经历顺序，"
               "把与权限模型、批量导入相关的成果前置，未新增任何未发生的事实。",
    "job_requirements": ["AI 产品需求分析", "竞品与用户研究", "PRD 撰写", "跨部门推进"],
    "changes": [
        {"section": "实习经历", "change_type": "换序",
         "reason": "岗位强调需求分析，先呈现访谈与竞品拆解的工作"},
        {"section": "项目经历", "change_type": "润色",
         "original": "设计信用分规则，纠纷率下降 35%",
         "revised": "设计信用分规则并推动上线，纠纷率下降 35%",
         "reason": "补上「推动上线」这一已发生的事实，动词更贴近岗位描述"},
    ],
}

RISKS = ["岗位要求 1-3 年经验，实习经历需要主动说明", "AI 产品经验属于相近场景迁移，面试需准备具体案例"]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    today = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    db = SessionLocal()
    try:
        if db.query(Job).count() or db.query(ResumeVersion).count():
            raise SystemExit("数据库里已有数据，先备份或清空 data/jobs.db 再运行。")

        resume = ResumeVersion(name="示例·产品岗通用版", content=DEMO_RESUME,
                               original_filename="demo-product.md", is_current=True)
        data_resume = ResumeVersion(name="示例·数据方向通用版", content=DEMO_RESUME_DATA,
                                    original_filename="demo-data.md", is_current=False)
        db.add_all([resume, data_resume])
        db.flush()

        jobs = []
        for index, spec in enumerate(JOBS):
            batch = today if index < 3 else today - timedelta(days=1)
            job = Job(batch_date=batch.strftime("%Y-%m-%d"),
                      collected_at=batch - timedelta(minutes=index * 7),
                      source_url="https://www.zhipin.com/",
                      jd_content=spec["jd_content"],
                      company=spec["company"], title=spec["title"],
                      location=spec["location"], salary=spec["salary"],
                      match_score=spec["match_score"], is_read=spec["is_read"],
                      is_valid=spec.get("is_valid", True))
            jobs.append(job)
            db.add(job)
        db.flush()

        tailored = TailoredResume(
            job_id=jobs[0].id, source_resume_id=resume.id, content=DEMO_RESUME,
            reason=json.dumps(REASON, ensure_ascii=False),
            keywords=json.dumps(KEYWORDS, ensure_ascii=False),
            risks=json.dumps(RISKS, ensure_ascii=False),
            status="draft", changes_confirmed=False,
        )
        db.add(tailored)

        db.add(CollectionRun(
            source="BOSS直聘", trigger="manual", status="success",
            started_at=today - timedelta(days=1, hours=2),
            finished_at=today - timedelta(days=1, hours=1, minutes=48),
            discovered=41, accepted=6, new_count=6, updated_count=0,
            archived_count=1, filtered_count=3,
            message="示例数据：本次为手动采集，共 6 个岗位写入本地。",
        ))
        db.commit()
        print(f"已写入：{len(jobs)} 个岗位、2 份通用简历、1 份定制草稿、1 条采集记录")
    finally:
        db.close()


if __name__ == "__main__":
    main()
