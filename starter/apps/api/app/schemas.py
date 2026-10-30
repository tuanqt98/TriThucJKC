from datetime import datetime
from typing import Optional, Annotated
from uuid import UUID
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str
    requestId: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class PasswordInput(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class ResetInput(BaseModel):
    token: str = Field(min_length=32, max_length=200)
    new_password: str = Field(min_length=12, max_length=256)


class UserInput(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9._-]{3,50}$")
    employee_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=2, max_length=150)
    department_id: UUID
    password: str = Field(min_length=12, max_length=256)


class RoleView(BaseModel):
    code: str
    scope_department_id: Optional[UUID]


class UserView(BaseModel):
    id: UUID
    username: Optional[str]
    full_name: str
    department_id: Optional[UUID]
    must_change_password: bool
    roles: list[RoleView]
    csrf_token: str


class Message(BaseModel):
    message: str


class Health(BaseModel):
    status: str


class ProcessView(BaseModel):
    id: UUID
    code: str
    name: str


class ContentView(BaseModel):
    id: UUID
    code: str
    kind: str
    title: str
    owner_department_id: Optional[UUID]
    department_name: Optional[str]
    version_id: UUID
    version_number: int
    body: dict
    status: str
    created_at: datetime


class ContentPage(BaseModel):
    items: list[ContentView]
    total: int
    page: int
    pageSize: int


class DashboardView(BaseModel):
    documents: int
    articles: int
    incidents: int
    learning: int
    pending_approvals: int
    processes: list[ProcessView]
    featured: list[ContentView]


class LearningView(BaseModel):
    status: str
    id: UUID
    title: str
    version_number: int
    due_at: Optional[datetime]
    completed_at: Optional[datetime]
    completed_lessons: int
    total_lessons: int


class ApprovalView(BaseModel):
    body: dict
    id: UUID
    title: str
    author: str
    version_number: int
    status: str
    requested_at: datetime


class OdooStatus(BaseModel):
    configured: bool
    version: Optional[str]
    message: str


class ArticleInput(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    body: dict[Annotated[str, Field(max_length=100)], Annotated[str, Field(max_length=5000)]] = Field(min_length=1, max_length=12)


class DraftView(BaseModel):
    id: UUID
    version_id: UUID
    status: str


class DecisionInput(BaseModel):
    expectedVersion: int = Field(ge=1)
    remark: str = Field(default="", max_length=1000)
