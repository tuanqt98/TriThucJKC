from typing import Protocol


class OdooAdapter(Protocol):
    def probe(self) -> dict: ...
    def fetch_employees(self, cursor: str = "") -> dict: ...
    def fetch_departments(self, cursor: str = "") -> dict: ...


class NoOpOdooAdapter:
    def probe(self) -> dict:
        return {"configured": False, "version": None, "message": "Chờ xác minh phiên bản, gói và quyền API Odoo."}

    def fetch_employees(self, cursor: str = "") -> dict:
        return {"items": [], "cursor": cursor, "available": False}

    def fetch_departments(self, cursor: str = "") -> dict:
        return {"items": [], "cursor": cursor, "available": False}
