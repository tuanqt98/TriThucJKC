from functools import lru_cache
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/jkc"
    app_origin: str = "http://localhost:3000"
    cookie_secure: bool = True
    app_env: str = "development"
    demo_password: str = ""
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
