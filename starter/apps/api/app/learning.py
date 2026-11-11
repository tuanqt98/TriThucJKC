from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, ConfigDict
from psycopg.types.json import Jsonb
from psycopg.errors import RaiseException
from app.db import DB
from app.permissions import current_user, fail
from app.schemas import Message

router = APIRouter(prefix="/api/v1", tags=["Learning"])


class Option(BaseModel):
    id: UUID
    answer_text: str


class Question(BaseModel):
    id: UUID
    question: str
    options: list[Option]


class Lesson(BaseModel):
    id: UUID
    title: str
    body: dict
    completed: bool


class Attempt(BaseModel):
    id: UUID
    attempt_no: int
    score: Optional[Decimal]
    passed: Optional[bool]
    correct_count: Optional[int]
    question_count: Optional[int]
    submitted_at: Optional[datetime]
    pass_score_snapshot: Optional[Decimal]


class CourseDetail(BaseModel):
    id: UUID
    title: str
    course_version_id: UUID
    version_number: int
    pass_score: Optional[Decimal]
    max_attempts: int
    completed_at: Optional[datetime]
    lessons: list[Lesson]
    questions: list[Question]
    attempts: list[Attempt]


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: UUID
    option_id: UUID


class Submission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: list[Answer] = Field(min_length=1, max_length=100)


def assignment(conn, user, id, lock=False):
    if lock and not conn.execute("SELECT jkc_lock_assignment(%s) AS allowed", (id,)).fetchone()["allowed"]:
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy khóa học được giao cho bạn.")
    row = conn.execute(
        """SELECT a.*,c.title,v.version_number,v.pass_score,v.max_attempts,v.status
        FROM course_assignments a JOIN course_versions v ON v.id=a.course_version_id JOIN courses c ON c.id=v.course_id
        WHERE a.id=%s AND a.user_id=%s AND v.status='APPROVED' """,
        (id, user["id"]),
    ).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy khóa học được giao cho bạn.")
    return row


@router.get("/my/learning/{id}", response_model=CourseDetail)
def course(id: UUID, user=Depends(current_user), conn=DB):
    row = assignment(conn, user, id)
    lessons = conn.execute(
        """SELECT l.id,l.title,l.body,EXISTS(SELECT 1 FROM lesson_progress p WHERE p.assignment_id=%s AND p.lesson_id=l.id) AS completed
        FROM lessons l WHERE l.course_version_id=%s ORDER BY l.order_no,l.id""",
        (id, row["course_version_id"]),
    ).fetchall()
    questions = conn.execute(
        "SELECT id,question FROM quiz_questions WHERE course_version_id=%s ORDER BY order_no,id", (row["course_version_id"],)
    ).fetchall()
    for q in questions:
        q["options"] = conn.execute("SELECT id,answer_text FROM quiz_options WHERE question_id=%s ORDER BY id", (q["id"],)).fetchall()
    attempts = conn.execute(
        "SELECT id,attempt_no,score,passed,correct_count,question_count,submitted_at,pass_score_snapshot FROM quiz_attempts WHERE assignment_id=%s ORDER BY attempt_no",
        (id,),
    ).fetchall()
    return {**row, "lessons": lessons, "questions": questions, "attempts": attempts}


@router.post("/my/learning/{id}/lessons/{lesson_id}/complete", response_model=Message)
def complete_lesson(id: UUID, lesson_id: UUID, request: Request, user=Depends(current_user), conn=DB):
    row = assignment(conn, user, id, lock=True)
    lesson = conn.execute("SELECT 1 FROM lessons WHERE id=%s AND course_version_id=%s", (lesson_id, row["course_version_id"])).fetchone()
    if not lesson:
        fail(404, "RESOURCE_NOT_FOUND", "Bài học không thuộc phiên bản khóa học được giao.")
    inserted = conn.execute(
        "INSERT INTO lesson_progress(assignment_id,lesson_id) VALUES (%s,%s) ON CONFLICT DO NOTHING RETURNING lesson_id", (id, lesson_id)
    ).fetchone()
    if inserted:
        conn.execute(
            "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'LESSON_COMPLETED','course_assignment',%s,%s)",
            (user["id"], id, request.state.request_id),
        )
    return {"message": "Đã ghi nhận hoàn thành bài học."}


@router.post("/my/learning/{id}/quiz-attempts", response_model=Attempt)
def start_attempt(id: UUID, request: Request, user=Depends(current_user), conn=DB):
    row = assignment(conn, user, id, lock=True)
    pending = conn.execute("SELECT * FROM quiz_attempts WHERE assignment_id=%s AND submitted_at IS NULL", (id,)).fetchone()
    if pending:
        return pending
    used = conn.execute("SELECT count(*) AS n FROM quiz_attempts WHERE assignment_id=%s", (id,)).fetchone()["n"]
    if used >= row["max_attempts"]:
        fail(409, "VERSION_CONFLICT", "Bạn đã sử dụng hết số lần làm bài cho phiên bản này.")
    if (
        row["pass_score"] is None
        or not conn.execute("SELECT 1 FROM quiz_questions WHERE course_version_id=%s", (row["course_version_id"],)).fetchone()
    ):
        fail(409, "VERSION_CONFLICT", "Phiên bản này chưa có bài kiểm tra hợp lệ.")
    missing = conn.execute(
        """SELECT 1 FROM lessons l WHERE l.course_version_id=%s AND NOT EXISTS
        (SELECT 1 FROM lesson_progress p WHERE p.assignment_id=%s AND p.lesson_id=l.id)""",
        (row["course_version_id"], id),
    ).fetchone()
    if missing:
        fail(409, "VERSION_CONFLICT", "Vui lòng hoàn thành tất cả bài học trước khi kiểm tra.")
    attempt = conn.execute("INSERT INTO quiz_attempts(assignment_id,attempt_no) VALUES (%s,%s) RETURNING *", (id, used + 1)).fetchone()
    conn.execute(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'QUIZ_STARTED','quiz_attempt',%s,%s)",
        (user["id"], attempt["id"], request.state.request_id),
    )
    return attempt


@router.post("/quiz-attempts/{id}/submit", response_model=Attempt)
def submit_quiz(id: UUID, data: Submission, request: Request, user=Depends(current_user), conn=DB):
    # Database function validates ownership, exact question set/options, version and state,
    # serializes submissions, grades from protected answer keys and stores immutable history.
    try:
        result = conn.execute(
            "SELECT * FROM jkc_submit_quiz(%s,%s,%s)",
            (id, Jsonb([a.model_dump(mode="json") for a in data.answers]), request.state.request_id),
        ).fetchone()
    except RaiseException as exc:
        conn.rollback()
        reason = exc.diag.message_primary
        if reason == "JKC_NOT_FOUND":
            fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy lần làm bài của bạn.")
        if reason == "JKC_INVALID":
            fail(422, "VALIDATION_ERROR", "Cần trả lời đúng mỗi câu một lần bằng lựa chọn thuộc câu hỏi.")
        if reason == "JKC_CONFLICT":
            fail(409, "VERSION_CONFLICT", "Lần làm đã nộp hoặc phiên bản/bài học chưa hợp lệ.")
        raise
    attempt_no = conn.execute("SELECT attempt_no FROM quiz_attempts WHERE id=%s", (id,)).fetchone()["attempt_no"]
    snapshot = conn.execute("SELECT pass_score_snapshot FROM quiz_attempts WHERE id=%s", (id,)).fetchone()["pass_score_snapshot"]
    return {**result, "attempt_no": attempt_no, "pass_score_snapshot": snapshot}
