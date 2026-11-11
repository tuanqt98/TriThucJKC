from datetime import datetime
from typing import Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from app.db import DB
from app.workspace_schemas import IncidentWorkspace, IncidentResult
from app.permissions import current_user
from app.workflows import StrictInput, execute

router = APIRouter(prefix="/api/v1/workspace/incidents", tags=["Incident records"])


class IncidentInput(StrictInput):
    title: str = Field(min_length=1, max_length=200)
    process_id: UUID
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    symptoms: str = Field(min_length=1, max_length=10000)
    conditions: dict
    occurred_at: Optional[datetime] = None


class IncidentUpdate(IncidentInput):
    incident_id: UUID
    revision: int = Field(ge=1)


class SolutionInput(StrictInput):
    incident_id: UUID
    cause: str = Field(min_length=1, max_length=10000)
    steps: list[str] = Field(min_length=1, max_length=100)
    outcome: str = Field(min_length=1, max_length=10000)


class VerifyInput(StrictInput):
    incident_revision: int = Field(ge=1)
    incident_id: UUID
    solution_id: UUID
    revision: int = Field(ge=1)
    verified_cause: str = Field(min_length=1, max_length=10000)


class OccurrenceInput(StrictInput):
    incident_id: UUID
    request_key: UUID
    note: str = Field(min_length=1, max_length=10000)
    outcome: str = Field(default="", max_length=10000)
    occurred_at: Optional[datetime] = None


@router.get("", response_model=list[IncidentWorkspace])
def records(user=Depends(current_user), conn=DB):
    return conn.execute("SELECT jkc_incident_workflow('list','{}',NULL) AS items").fetchone()["items"]


@router.post("", response_model=IncidentResult, status_code=201)
def create(data: IncidentInput, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_incident_workflow", "create", data, request)


@router.put("", response_model=IncidentResult)
def update(data: IncidentUpdate, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_incident_workflow", "update", data, request)


@router.post("/solutions", response_model=IncidentResult, status_code=201)
def propose(data: SolutionInput, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_incident_workflow", "propose", data, request)


@router.post("/verify", response_model=IncidentResult)
def verify(data: VerifyInput, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_incident_workflow", "verify", data, request)


@router.post("/occurrences", response_model=IncidentResult, status_code=201)
def occur(data: OccurrenceInput, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_incident_workflow", "occur", data, request)
