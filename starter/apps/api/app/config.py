from functools import lru_cache
from pathlib import Path
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/jkc"
    app_origin: str = "http://localhost:3000"
    cookie_secure: bool = True
    app_env: str = "development"
    demo_password: str = ""
    require_runtime_role: bool = False
    require_file_storage: bool = False
    max_signature_age_days: int = Field(default=7, ge=1, le=30)
    file_storage_path: Path = Path(".local/uploads")
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=25 * 1024 * 1024)
    clamav_host: str = "127.0.0.1"
    clamav_port: int = 3310
    clamav_timeout: int = 20
    session_hours: int = Field(default=8, ge=1, le=24)

    @model_validator(mode="after")
    def enforce_staging_cookie(self):
        if self.app_env in ("production", "staging") and (not self.cookie_secure or not self.app_origin.startswith("https://")):
            raise ValueError("Staging/production require HTTPS origin and Secure cookies")
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def settings():
    return Settings()
