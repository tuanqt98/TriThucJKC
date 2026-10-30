import uuid
from copy import deepcopy
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import OperationalError
from psycopg.errors import UndefinedTable
from app.auth import router as auth_router
from app.content import router as content_router
from app.files import router as file_router, ClamAVScanner
from app.reading import router as reading_router
from app.learning import router as learning_router
from app.workflows import router as workflow_router
from app.incident_records import router as incident_router
from app.training_authoring import router as training_authoring_router
from app.config import settings
from app.db import DB
from app.schemas import ErrorResponse, Health


def create_app():
    app = FastAPI(
        title="Tri Thức JKC API",
        version="0.4.0",
        description="Sprint 1: authoring/version/review, hồ sơ sự cố và đào tạo. Nội dung seed là DEMO; chưa nghiệm thu production.",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
        responses={s: {"model": ErrorResponse} for s in [400, 401, 403, 404, 409, 413, 422, 429, 503]},
    )

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > settings().max_upload_bytes + 65536:
            response = JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "FILE_TOO_LARGE",
                        "message": "Yêu cầu vượt giới hạn dung lượng.",
                        "requestId": request.state.request_id,
                    }
                },
            )
        elif request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("origin") != settings().app_origin:
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
    def ready(conn=DB):
        row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
        if not row or row["version_num"] != "007":
            raise HTTPException(503, {"code": "NOT_READY", "message": "Database chưa được migration."})
        if settings().require_runtime_role:
            role = conn.execute(
                "SELECT r.rolsuper,r.rolbypassrls,EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relowner=r.oid) AS owns FROM pg_roles r WHERE r.rolname=current_user"
            ).fetchone()
            if role["rolsuper"] or role["rolbypassrls"] or role["owns"]:
                raise HTTPException(503, {"code": "UNSAFE_DB_ROLE", "message": "API không được chạy bằng DB owner/superuser."})
        if settings().require_file_storage:
            import tempfile

            try:
                with tempfile.TemporaryFile(dir=settings().file_storage_path) as stream:
                    stream.write(b"health")
            except OSError:
                raise HTTPException(503, {"code": "STORAGE_NOT_READY", "message": "Kho tệp riêng tư chưa sẵn sàng."})
            ClamAVScanner().status()
        return {"status": "ready"}

    app.include_router(auth_router)
    app.include_router(content_router)
    app.include_router(file_router)
    app.include_router(reading_router)
    app.include_router(learning_router)
    app.include_router(workflow_router)
    app.include_router(incident_router)
    app.include_router(training_authoring_router)
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
