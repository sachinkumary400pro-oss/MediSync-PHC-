from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "MediSync PHC"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret Key for JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "medisync-tamilnadu-secret-jwt-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database: SQLite by default for development, easily switched to PostgreSQL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./data/medisync_fastapi.db"
    )

    # Pluggable Services
    ENABLE_SMS_MOCK: bool = True
    ENABLE_WHATSAPP_MOCK: bool = True
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", None)

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
