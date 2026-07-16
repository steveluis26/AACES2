import os
import json
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
from cryptography.fernet import Fernet

class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "AACES - Sistema de Gestión de Capacitaciones"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Security settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days
    ALGORITHM: str = "HS256"
    ALLOW_DEV_LOGIN: bool = os.getenv("ALLOW_DEV_LOGIN", "0") in ("1", "true", "True")
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/aaces_db")
    DATABASE_POOL_SIZE: int = int(os.getenv("DATABASE_POOL_SIZE", "20"))
    DATABASE_MAX_OVERFLOW: int = int(os.getenv("DATABASE_MAX_OVERFLOW", "40"))
    
    # Redis settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://verceldeploy-riquer.vercel.app",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return v
    
    # Email settings
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@aaces.com")
    
    # File upload settings
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "./storage")
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local")
    
    # Certificate settings
    CERTIFICATE_TEMPLATE_DIR: str = os.getenv("CERTIFICATE_TEMPLATE_DIR", "./templates/certificates")
    CERTIFICATE_VALIDITY_DAYS: int = int(os.getenv("CERTIFICATE_VALIDITY_DAYS", "1095"))  # 3 years

    # Validation settings
    MAX_VALIDATION_ATTEMPTS: int = int(os.getenv("MAX_VALIDATION_ATTEMPTS", "5"))
    VALIDATION_LOCKOUT_MINUTES: int = int(os.getenv("VALIDATION_LOCKOUT_MINUTES", "30"))
    
    # Security settings
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "60"))
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    LOGIN_LOCKOUT_MINUTES: int = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "30"))
    
    # Audit settings
    AUDIT_RETENTION_DAYS: int = int(os.getenv("AUDIT_RETENTION_DAYS", "2555"))  # 7 years
    
    # Encryption key for sensitive data
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())

    # Payments settings
    MERCADOPAGO_ACCESS_TOKEN: str = os.getenv("MERCADOPAGO_ACCESS_TOKEN", "")
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://127.0.0.1:3000")
    PUBLIC_API_BASE_URL: str = os.getenv("PUBLIC_API_BASE_URL", "http://127.0.0.1:8000/api/v1")

    AACES_PRICE_MONTH: float = float(os.getenv("AACES_PRICE_MONTH", "0"))
    AACES_PRICE_6M: float = float(os.getenv("AACES_PRICE_6M", "0"))
    AACES_PRICE_YEAR: float = float(os.getenv("AACES_PRICE_YEAR", "0"))

    
    
    @field_validator("ENCRYPTION_KEY", mode="before")
    @classmethod
    def validate_encryption_key(cls, v):
        if not v or len(v) < 32:
            return Fernet.generate_key().decode()
        return v
    
    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v):
        if v == "your-secret-key-change-in-production":
            import warnings
            warnings.warn("Using default SECRET_KEY. Please set a secure SECRET_KEY in production.")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()
