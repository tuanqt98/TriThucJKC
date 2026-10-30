"""Private attachments. No static mount, client storage key, or unscanned download."""

import hashlib
import io
import os
from pathlib import Path
import re
import socket
import stat
import struct
import warnings
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from typing import Protocol
from urllib.parse import quote
from fastapi import APIRouter, Depends, File, UploadFile, Request, Response
from pydantic import BaseModel
from PIL import Image
from pypdf import PdfReader, PdfWriter
from app.config import settings
from app.db import database
from app.permissions import current_user, fail, READ_ACL, acl_params

router = APIRouter(prefix="/api/v1", tags=["Files"])
Image.MAX_IMAGE_PIXELS = 20_000_000


class Attachment(BaseModel):
    id: UUID
    filename: str
    mime_type: str
    byte_size: int
    sha256: str
    malware_scan_status: str
    created_at: datetime


class Scanner(Protocol):
    def scan(self, data: bytes) -> bool: ...


class ClamAVScanner:
    def status(self):
        try:
            with socket.create_connection((settings().clamav_host, settings().clamav_port), timeout=3) as sock:
                sock.sendall(b"zVERSION\0")
                reply = sock.recv(4096).rstrip(b"\0").decode("ascii")
            stamp = datetime.strptime(reply.split("/", 2)[2].strip(), "%a %b %d %H:%M:%S %Y").replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - stamp > timedelta(days=settings().max_signature_age_days):
                raise ValueError("Stale signatures")
            return reply
        except (OSError, ValueError, IndexError, UnicodeError):
            fail(503, "SCAN_UNAVAILABLE", "Bộ quét chưa sẵn sàng hoặc chữ ký quá cũ; upload bị khóa.")

    def scan(self, data: bytes) -> bool:
        self.status()
        try:
            with socket.create_connection((settings().clamav_host, settings().clamav_port), timeout=settings().clamav_timeout) as sock:
                sock.sendall(b"zINSTREAM\0")
                for offset in range(0, len(data), 65536):
                    chunk = data[offset : offset + 65536]
                    sock.sendall(struct.pack("!I", len(chunk)) + chunk)
                sock.sendall(struct.pack("!I", 0))
                reply = b""
                while not reply.endswith(b"\0"):
                    chunk = sock.recv(4096)
                    if not chunk or len(reply) > 8192:
                        raise OSError("Invalid scanner response")
                    reply += chunk
            if reply == b"stream: OK\0":
                return True
            if reply.endswith(b" FOUND\0"):
                return False
            raise OSError("Scanner did not confirm CLEAN")
        except OSError:
            fail(503, "SCAN_UNAVAILABLE", "Bộ quét mã độc chưa sẵn sàng. Tệp chưa được lưu; vui lòng thử lại.")


def scanner():
    return ClamAVScanner()


def filename_safe(name):
    if not name or len(name) > 120 or name in (".", "..") or re.search(r"[/\\\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]", name):
        fail(422, "VALIDATION_ERROR", "Tên tệp không hợp lệ; không được chứa đường dẫn hoặc ký tự điều khiển.")
    return name


def normalize(data, name, mime):
    suffix = Path(name).suffix.lower()
    if suffix in (".png", ".jpg", ".jpeg"):
        expected = "PNG" if suffix == ".png" else "JPEG"
        expected_mime = "image/png" if expected == "PNG" else "image/jpeg"
        if mime != expected_mime:
            fail(422, "VALIDATION_ERROR", "Loại tệp không khớp phần mở rộng.")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as img:
                    if img.format != expected or img.width * img.height > 20_000_000:
                        raise ValueError("Image type/size mismatch")
                    img.verify()
                with Image.open(io.BytesIO(data)) as img:
                    output = io.BytesIO()
                    img.convert("RGB" if expected == "JPEG" else "RGBA").save(output, format=expected)
                    return output.getvalue(), expected_mime
        except (OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            fail(422, "VALIDATION_ERROR", "Ảnh lỗi hoặc vượt giới hạn số điểm ảnh.")
    if suffix == ".pdf" and mime == "application/pdf" and data.startswith(b"%PDF-"):
        try:
            reader = PdfReader(io.BytesIO(data), strict=True)
            if reader.is_encrypted or not 1 <= len(reader.pages) <= 100:
                raise ValueError("Encrypted/oversize PDF")
            forbidden = {"/JS", "/JavaScript", "/AA", "/OpenAction", "/Launch", "/EmbeddedFiles", "/RichMedia", "/AcroForm", "/XFA", "/URI"}
            seen = set()
            stack = [reader.trailer]
            nodes = 0
            while stack:
                obj = stack.pop()
                obj = obj.get_object() if hasattr(obj, "get_object") else obj
                if id(obj) in seen:
                    continue
                seen.add(id(obj))
                nodes += 1
                if nodes > 20000:
                    raise ValueError("PDF too complex")
                if isinstance(obj, dict):
                    if forbidden.intersection(map(str, obj.keys())):
                        raise ValueError("Active PDF")
                    stack.extend(obj.values())
                elif isinstance(obj, list):
                    stack.extend(obj)
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            output = io.BytesIO()
            writer.write(output)
            return output.getvalue(), "application/pdf"
        except Exception:
            fail(422, "VALIDATION_ERROR", "PDF không hợp lệ, có nội dung chủ động, mã hóa hoặc quá phức tạp.")
    fail(422, "VALIDATION_ERROR", "Chỉ hỗ trợ PNG, JPEG và PDF tĩnh đúng định dạng.")


def version_access(conn, user, id):
    row = conn.execute(
        """SELECT v.id,v.content_id,v.status,c.creator_id,c.owner_department_id,c.kind,
        c.current_published_version_id,"""
        + READ_ACL
        + """ AS acl
        FROM content_versions v JOIN contents c ON c.id=v.content_id
        WHERE v.id=%(id)s AND c.archived_at IS NULL""",
        {**acl_params(user), "id": id},
    ).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy phiên bản được quyền truy cập.")
    own = row["creator_id"] == user["id"]
    published = row["status"] == "APPROVED" and row["acl"]
    assigned = conn.execute("SELECT assigned_user_id FROM approvals WHERE version_id=%s", (id,)).fetchone()
    reviewer = (
        row["status"] == "PENDING"
        and row["acl"]
        and conn.execute("SELECT jkc_review(%s) AS allowed", (row["content_id"],)).fetchone()["allowed"]
        and assigned
        and (assigned["assigned_user_id"] is None or assigned["assigned_user_id"] == user["id"])
    )
    if not (own or published or reviewer):
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy phiên bản được quyền truy cập.")
    return row


@router.get("/content-versions/{id}/attachments", response_model=list[Attachment])
def attachments(id: UUID, user=Depends(current_user), conn=Depends(database)):
    version_access(conn, user, id)
    return conn.execute(
        "SELECT id,filename,mime_type,byte_size,sha256,malware_scan_status,created_at FROM attachments WHERE content_version_id=%s ORDER BY created_at,id",
        (id,),
    ).fetchall()


@router.post("/content-versions/{id}/attachments", response_model=Attachment, status_code=201)
def upload(
    id: UUID, request: Request, file: UploadFile = File(...), user=Depends(current_user), conn=Depends(database), av=Depends(scanner)
):
    # Serialize with submit/approve: attachments cannot change after submission.
    row = version_access(conn, user, id)
    if row["creator_id"] != user["id"] or row["status"] != "DRAFT":
        fail(403, "FORBIDDEN", "Chỉ tác giả được đính kèm vào bản nháp chưa gửi duyệt.")
    conn.execute("SELECT id FROM content_versions WHERE id=%s FOR UPDATE", (id,))
    row = version_access(conn, user, id)
    if row["status"] != "DRAFT":
        fail(409, "VERSION_CONFLICT", "Bản nháp đã chuyển trạng thái.")
    name = filename_safe(file.filename)
    parts = []
    size = 0
    try:
        while True:
            chunk = file.file.read(65536)
            if not chunk:
                break
            size += len(chunk)
            if size > settings().max_upload_bytes:
                fail(413, "FILE_TOO_LARGE", "Tệp vượt giới hạn dung lượng.")
            parts.append(chunk)
    finally:
        file.file.close()
    raw = b"".join(parts)
    if not av.scan(raw):
        fail(422, "UNSAFE_FILE", "Tệp bị phát hiện có mã độc.")
    data, mime = normalize(raw, name, file.content_type)
    if len(data) > settings().max_upload_bytes:
        fail(413, "FILE_TOO_LARGE", "Tệp sau kiểm tra vượt giới hạn dung lượng.")
    if not av.scan(data):
        fail(422, "UNSAFE_FILE", "Tệp chưa vượt qua kiểm tra mã độc.")
    key = uuid4().hex
    root = settings().file_storage_path.resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = root / key
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        result = conn.execute(
            """INSERT INTO attachments(content_version_id,filename,storage_key,mime_type,byte_size,sha256,malware_scan_status,uploaded_by)
            VALUES (%s,%s,%s,%s,%s,%s,'CLEAN',%s) RETURNING id,filename,mime_type,byte_size,sha256,malware_scan_status,created_at""",
            (id, name, key, mime, len(data), hashlib.sha256(data).hexdigest(), user["id"]),
        ).fetchone()
        conn.execute(
            "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'FILE_UPLOADED','attachment',%s,%s)",
            (user["id"], result["id"], request.state.request_id),
        )
        conn.commit()  # File and metadata durable before returning. On failure remove only this random key.
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return result


@router.get("/attachments/{id}/download", response_class=Response, responses={200: {"content": {"application/octet-stream": {}}}})
def download(id: UUID, user=Depends(current_user), conn=Depends(database)):
    row = conn.execute("SELECT * FROM attachments WHERE id=%s", (id,)).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tệp được quyền tải.")
    version_access(conn, user, row["content_version_id"])
    if row["malware_scan_status"] != "CLEAN":
        fail(409, "FILE_NOT_READY", "Tệp chưa được xác nhận an toàn.")
    if not re.fullmatch(r"[a-f0-9]{32}", row["storage_key"]):
        fail(503, "FILE_UNAVAILABLE", "Tệp chưa sẵn sàng.")
    try:
        fd = os.open(settings().file_storage_path.resolve() / row["storage_key"], os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise OSError("Not regular file")
            data = stream.read(settings().max_upload_bytes + 1)
        if len(data) != row["byte_size"] or hashlib.sha256(data).hexdigest() != row["sha256"]:
            raise OSError("Integrity mismatch")
    except OSError:
        fail(503, "FILE_UNAVAILABLE", "Tệp thiếu hoặc không vượt qua kiểm tra toàn vẹn.")
    return Response(
        content=data,
        media_type=row["mime_type"],
        headers={
            "Content-Disposition": "attachment; filename*=UTF-8''" + quote(row["filename"], safe=""),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
        },
    )
