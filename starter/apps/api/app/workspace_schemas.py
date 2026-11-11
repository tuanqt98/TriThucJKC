from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class VersionResult(BaseModel):
    id: UUID
    version_id: UUID
    version_number: int
    revision: int
    status: str


class ContentWorkspace(VersionResult):
    title: str
    kind: str
    visibility: str
    creator_id: UUID
    owner_department_id: UUID
    body: dict
    process_id: Optional[UUID]
    created_at: datetime
    can_edit: bool
    can_review: bool
    remark: Optional[str]


class PersonView(BaseModel):
    id: UUID
    full_name: str
    department_id: UUID
    department_name: str


class ReadingProgress(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    department_id: UUID
    content_id: UUID
    title: str
    version_id: UUID
    version_number: int
    due_at: Optional[datetime]
    created_at: datetime
    acknowledged_at: Optional[datetime]
    is_current: bool
    status: str


class LessonAuthoring(BaseModel):
    id: UUID
    title: str
    body: dict
    order_no: int


class AuthorOption(BaseModel):
    answer_text: str
    is_correct: bool


class AuthorQuestion(BaseModel):
    question: str
    options: list[AuthorOption]


class CourseWorkspace(VersionResult):
    title: str
    created_by: Optional[UUID]
    owner_department_id: UUID
    pass_score: Optional[float]
    max_attempts: int
    can_edit: bool
    can_review: bool
    lessons: list[LessonAuthoring]
    questions: list[AuthorQuestion]


class TrainingProgress(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    title: str
    version_number: int
    due_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: str


class IncidentSolution(BaseModel):
    id: UUID
    proposed_by: UUID
    cause_hypothesis: Optional[str]
    steps: list[str]
    outcome: Optional[str]
    status: str
    revision: int
    verified_cause: Optional[str]
    verified_by: Optional[UUID]
    verified_at: Optional[datetime]


class OccurrenceView(BaseModel):
    id: UUID
    reported_by: UUID
    occurred_at: datetime
    note: Optional[str]
    outcome: Optional[str]


class IncidentWorkspace(BaseModel):
    id: UUID
    code: str
    title: str
    process_id: Optional[UUID]
    reporter_id: UUID
    owner_department_id: UUID
    severity: str
    symptoms: str
    conditions: dict
    occurred_at: Optional[datetime]
    created_at: datetime
    revision: int
    can_edit: bool
    can_verify: bool
    solutions: list[IncidentSolution]
    occurrences: list[OccurrenceView]


class IncidentResult(BaseModel):
    id: UUID
    revision: Optional[int] = None
    solution_id: Optional[UUID] = None
    solution_revision: Optional[int] = None
    occurrence_id: Optional[UUID] = None
