from contextlib import contextmanager
import psycopg
from fastapi import Depends
from psycopg.rows import dict_row
from app.config import settings


@contextmanager
def connection():
    with psycopg.connect(settings().database_url, row_factory=dict_row) as conn:
        yield conn


def database():
    with connection() as conn:
        yield conn


# Commit/rollback before HTTP response.start. Request-scoped yield cleanup runs
# after sending the response and can expose a session cookie or success before
# its INSERT/UPDATE is visible to the client's next request.
DB = Depends(database, scope="function")
