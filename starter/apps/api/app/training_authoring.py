from datetime import datetime
from typing import Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from app.db import database
from app.workspace_schemas import CourseWorkspace, VersionResult, TrainingProgress
from app.permissions import current_user, fail
from app.workflows import StrictInput, execute

router = APIRouter(prefix="/api/v1/workspace/courses", tags=["Training authoring"])


class CourseCreate(StrictInput):
    title: str = Field(min_length=1, max_length=200)


class CourseVersionInput(StrictInput):
    course_id: UUID
    version_id: UUID
    revision: int = Field(ge=1)


class LessonInput(StrictInput):
    title: str = Field(min_length=1, max_length=200)
    body: dict


class OptionInput(StrictInput):
    answer_text: str = Field(min_length=1, max_length=2000)
    is_correct: bool


class QuestionInput(StrictInput):
    question: str = Field(min_length=1, max_length=2000)
    options: list[OptionInput] = Field(min_length=2, max_length=10)


class CourseSave(CourseVersionInput):
    pass_score: int = Field(ge=1, le=100)
    max_attempts: int = Field(ge=1, le=10)
    lessons: list[LessonInput] = Field(min_length=1, max_length=100)
    questions: list[QuestionInput] = Field(min_length=1, max_length=100)


class CourseAssign(CourseVersionInput):
    user_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    due_at: Optional[datetime] = None


@router.get("", response_model=list[CourseWorkspace])
def courses(user=Depends(current_user), conn=Depends(database)):
    return conn.execute("SELECT jkc_course_workspace() AS items").fetchone()["items"]


@router.get("/progress", response_model=list[TrainingProgress])
def progress(user=Depends(current_user), conn=Depends(database)):
    return conn.execute("SELECT jkc_training_progress() AS items").fetchone()["items"]


@router.post("", response_model=VersionResult, status_code=201)
def create(data: CourseCreate, request: Request, user=Depends(current_user), conn=Depends(database)):
    return execute(conn, "jkc_course_workflow", "create", data, request)


@router.put("", response_model=VersionResult)
def save(data: CourseSave, request: Request, user=Depends(current_user), conn=Depends(database)):
    return execute(conn, "jkc_course_workflow", "save", data, request)


@router.post("/assign", response_model=VersionResult, status_code=201)
def assign(data: CourseAssign, request: Request, user=Depends(current_user), conn=Depends(database)):
    if bool(data.user_id) == bool(data.department_id):
        fail(422, "VALIDATION_ERROR", "Chọn một nhân viên hoặc một bộ phận.")
    return execute(conn, "jkc_course_workflow", "assign", data, request)


@router.post("/{action}", response_model=VersionResult)
def transition(
    action: Literal["submit", "approve", "fork"],
    data: CourseVersionInput,
    request: Request,
    user=Depends(current_user),
    conn=Depends(database),
):
    return execute(conn, "jkc_course_workflow", action, data, request)
