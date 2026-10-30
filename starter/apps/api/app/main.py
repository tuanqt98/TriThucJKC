import uuid
from copy import deepcopy
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import OperationalError
from psycopg.errors import UndefinedTable
from app.auth import router as auth_router
from app.content import router as content_router
from app.config import settings
from app.db import database
from app.schemas import ErrorResponse, Health


def create_app():
    app = FastAPI(
        title="Tri Thức JKC API",
        version="0.2.0",
        description="Sprint 0: chỉ các endpoint đã triển khai. Nội dung seed là DEMO.",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
        responses={s: {"model": ErrorResponse} for s in [400, 401, 403, 404, 409, 422, 429, 503]},
    )

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("origin") != settings().app_origin:
            response = JSONResponse(
                status_code=403,
                content={"error": {"code": "FORBIDDEN", "message": "Origin không hợp lệ.", "requestId": request.state.request_id}},
            )
        else:
            response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(OperationalError)
    @app.exception_handler(UndefinedTable)
    async def database_error(request: Request, exc):
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "NOT_READY", "message": "Database chưa sẵn sàng.", "requestId": request.state.request_id}},
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc):
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "RESOURCE_NOT_FOUND", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": {**detail, "requestId": request.state.request_id}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Dữ liệu không hợp lệ. Kiểm tra các trường bắt buộc và độ dài.",
                    "requestId": request.state.request_id,
                }
            },
        )

    @app.get("/api/v1/health/live", response_model=Health, tags=["System"])
    def live():
        return {"status": "ok"}

    @app.get("/api/v1/health/ready", response_model=Health, tags=["System"])
    def ready(conn=Depends(database)):
        row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
        if not row or row["version_num"] != "002":
            raise HTTPException(503, {"code": "NOT_READY", "message": "Database chưa được migration."})
        return {"status": "ready"}

    app.include_router(auth_router)
    app.include_router(content_router)
    # Explicit cookie security in generated contract (dependencies perform actual checks).
    original = app.openapi

    def contract():
        schema = deepcopy(original())
        schema.setdefault("components", {}).setdefault("securitySchemes", {})["sessionCookie"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": "jkc_session",
        }
        public = {"/api/v1/auth/login", "/api/v1/auth/reset", "/api/v1/health/live", "/api/v1/health/ready"}
        for path, methods in schema["paths"].items():
            for method, operation in methods.items():
                operation["security"] = [] if path in public else [{"sessionCookie": []}]
                if method not in ("get", "head", "options"):
                    operation.setdefault("parameters", []).append(
                        {
                            "name": "Origin",
                            "in": "header",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "Phải bằng APP_ORIGIN.",
                        }
                    )
                    if path not in public:
                        operation["parameters"].append(
                            {
                                "name": "X-CSRF-Token",
                                "in": "header",
                                "required": True,
                                "schema": {"type": "string"},
                                "description": "Lấy từ login hoặc auth/me.",
                            }
                        )
        return schema

    app.openapi = contract
    return app


app = create_app()
