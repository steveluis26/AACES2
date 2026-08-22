import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
import json
from app.core.config import settings
from app.core.logging import audit_logger
import logging

logger = logging.getLogger(__name__)

class SecurityService:
    """Service for handling security operations like password hashing and JWT tokens."""
    
    def __init__(self):
        self.cipher = Fernet(settings.ENCRYPTION_KEY.encode())
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        try:
            return bcrypt.checkpw(
                password.encode('utf-8'),
                hashed_password.encode('utf-8')
            )
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create a JWT refresh token."""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode a JWT token."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError as e:
            logger.error(f"Token decode error: {e}")
            return None
    
    def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data."""
        encrypted = self.cipher.encrypt(data.encode())
        return encrypted.decode()
    
    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        try:
            decrypted = self.cipher.decrypt(encrypted_data.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Data decryption error: {e}")
            raise ValueError("Failed to decrypt data")
    
    def generate_validation_code(self) -> str:
        """Generate a unique validation code."""
        import secrets
        import string
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(8))
    
    def generate_certificate_id(self) -> str:
        """Generate a unique certificate ID."""
        import secrets
        import string
        alphabet = string.ascii_uppercase + string.digits
        timestamp = datetime.now().strftime("%Y%m%d")
        random_part = ''.join(secrets.choice(alphabet) for _ in range(6))
        return f"CERT-{timestamp}-{random_part}"
    
    def sanitize_html(self, html: str) -> str:
        """Sanitize HTML input to prevent XSS attacks."""
        import re
        # Remove script tags and event handlers
        html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html, flags=re.IGNORECASE)
        html = re.sub(r'javascript:', '', html, flags=re.IGNORECASE)
        return html
    
    def validate_email_domain(self, email: str, allowed_domains: list) -> bool:
        """Validate email domain against allowed domains."""
        domain = email.split('@')[1].lower()
        return domain in [d.lower() for d in allowed_domains]
    
    def generate_secure_filename(self, filename: str) -> str:
        """Generate a secure filename to prevent directory traversal."""
        import re
        import uuid
        # Remove path components
        filename = filename.split('/')[-1].split('\\')[-1]
        # Remove special characters
        filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
        # Add UUID prefix
        return f"{uuid.uuid4().hex}_{filename}"
    
    def log_security_event(self, event_type: str, user_id: Optional[str], details: Dict[str, Any]):
        """Log security events for audit purposes."""
        audit_logger.log_system_event(event_type, f"Security event for user {user_id}", details)

class RateLimiter:
    """Simple rate limiter using Redis or in-memory storage."""
    
    def __init__(self):
        self.storage = {}  # In-memory storage for development
    
    def is_rate_limited(self, key: str, limit: int, window: int) -> bool:
        """Check if a key is rate limited."""
        now = datetime.now()
        if key not in self.storage:
            self.storage[key] = []
        
        # Remove old entries
        self.storage[key] = [timestamp for timestamp in self.storage[key] if (now - timestamp).seconds < window]
        
        # Check if limit exceeded
        if len(self.storage[key]) >= limit:
            return True
        
        # Add current request
        self.storage[key].append(now)
        return False
    
    def get_remaining_attempts(self, key: str, limit: int, window: int) -> int:
        """Get remaining attempts for a key."""
        if key not in self.storage:
            return limit
        
        now = datetime.now()
        # Remove old entries
        self.storage[key] = [timestamp for timestamp in self.storage[key] if (now - timestamp).seconds < window]
        
        return max(0, limit - len(self.storage[key]))
    
    def reset_limit(self, key: str):
        """Reset rate limit for a key."""
        if key in self.storage:
            del self.storage[key]

# Global instances
security_service = SecurityService()
rate_limiter = RateLimiter()