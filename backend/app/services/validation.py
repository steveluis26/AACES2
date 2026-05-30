import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class ValidationService:
    """Service for certificate validation and verification."""
    
    def __init__(self):
        self.validation_cache = {}
    
    def validate_certificate_format(self, codigo_validacion: str) -> bool:
        """Validate certificate validation code format."""
        if not codigo_validacion:
            return False
        
        # Check minimum length
        if len(codigo_validacion) < 8:
            return False
        
        # Check for valid characters (alphanumeric and hyphens)
        import re
        if not re.match(r'^[A-Za-z0-9-]+$', codigo_validacion):
            return False
        
        return True
    
    def generate_validation_code(self) -> str:
        """Generate a unique validation code."""
        import secrets
        import string
        
        # Generate a 12-character code with mix of uppercase, lowercase, and numbers
        alphabet = string.ascii_letters + string.digits
        code = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Add hyphens for better readability
        formatted_code = f"{code[:4]}-{code[4:8]}-{code[8:]}"
        
        return formatted_code
    
    def is_certificate_expired(self, fecha_expiracion: Optional[datetime]) -> bool:
        """Check if certificate has expired."""
        if not fecha_expiracion:
            return False  # No expiration date means it's valid indefinitely
        
        return datetime.now().date() > fecha_expiracion.date()
    
    def get_certificate_status(self, curso_participante_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get comprehensive certificate status."""
        status = {
            "valido": False,
            "mensaje": "",
            "acreditado": curso_participante_data.get("acreditado", False),
            "expirado": False,
            "fecha_emision": curso_participante_data.get("fecha_emision_certificado"),
            "fecha_expiracion": curso_participante_data.get("fecha_expiracion_certificado"),
        }
        
        # Check if participant is accredited
        if not status["acreditado"]:
            status["mensaje"] = "El participante no está acreditado para este curso"
            return status
        
        # Check if certificate has expired
        fecha_expiracion = curso_participante_data.get("fecha_expiracion_certificado")
        if fecha_expiracion and self.is_certificate_expired(fecha_expiracion):
            status["expirado"] = True
            status["mensaje"] = "El certificado ha expirado"
            return status
        
        # Certificate is valid
        status["valido"] = True
        status["mensaje"] = "Certificado válido"
        
        return status
    
    def validate_participant_eligibility(
        self,
        participante_data: Dict[str, Any],
        curso_data: Dict[str, Any],
        nota_minima: float = 7.0
    ) -> Dict[str, Any]:
        """Validate if participant is eligible for certification."""
        eligibility = {
            "eligible": False,
            "reasons": [],
            "requirements_met": {}
        }
        
        # Check course completion
        if not participante_data.get("curso_completado", False):
            eligibility["reasons"].append("El curso no ha sido completado")
        else:
            eligibility["requirements_met"]["curso_completado"] = True
        
        # Check minimum grade
        nota_final = participante_data.get("nota_final", 0)
        if nota_final < nota_minima:
            eligibility["reasons"].append(f"Nota final insuficiente: {nota_final} (mínima requerida: {nota_minima})")
        else:
            eligibility["requirements_met"]["nota_minima"] = True
        
        # Check attendance (if applicable)
        asistencia_minima = curso_data.get("asistencia_minima", 80)
        asistencia = participante_data.get("porcentaje_asistencia", 0)
        if asistencia < asistencia_minima:
            eligibility["reasons"].append(f"Asistencia insuficiente: {asistencia}% (mínima requerida: {asistencia_minima}%)")
        else:
            eligibility["requirements_met"]["asistencia_minima"] = True
        
        # Check payment status
        estado_pago = participante_data.get("estado_pago", "pendiente")
        if estado_pago != "pagado":
            eligibility["reasons"].append(f"Pago pendiente: {estado_pago}")
        else:
            eligibility["requirements_met"]["pago_completado"] = True
        
        # Determine overall eligibility
        if not eligibility["reasons"]:
            eligibility["eligible"] = True
        
        return eligibility
    
    def log_validation_attempt(
        self,
        codigo_validacion: str,
        resultado: bool,
        detalles: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log validation attempt for audit purposes."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "codigo_validacion": codigo_validacion,
            "resultado": resultado,
            "detalles": detalles or {}
        }
        
        if resultado:
            logger.info(f"Validación exitosa: {codigo_validacion}")
        else:
            logger.warning(f"Validación fallida: {codigo_validacion}")
        
        # Store in cache for rate limiting
        self.validation_cache[codigo_validacion] = log_entry
    
    def get_validation_statistics(self) -> Dict[str, Any]:
        """Get validation statistics."""
        total_attempts = len(self.validation_cache)
        successful_attempts = sum(1 for entry in self.validation_cache.values() if entry["resultado"])
        failed_attempts = total_attempts - successful_attempts
        
        return {
            "total_intentos": total_attempts,
            "intentos_exitosos": successful_attempts,
            "intentos_fallidos": failed_attempts,
            "tasa_exito": (successful_attempts / total_attempts * 100) if total_attempts > 0 else 0
        }

    def validate_curp(self, curp: str) -> bool:
        import re
        if not curp:
            return False
        c = curp.strip().upper()
        return re.fullmatch(r"^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$", c) is not None

    def validate_rfc(self, rfc: str) -> bool:
        import re
        if not rfc:
            return False
        r = rfc.strip().upper()
        if len(r) == 13:
            return re.fullmatch(r"^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$", r) is not None
        if len(r) == 12:
            return re.fullmatch(r"^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$", r) is not None
        return False

    def validate_document(self, tipo: Optional[str], numero: str) -> bool:
        if not numero:
            return False
        t = (tipo or "").strip().upper()
        if t == "CURP":
            return self.validate_curp(numero)
        if t == "RFC":
            return self.validate_rfc(numero)
        return True

# Create singleton instance
validation_service = ValidationService()
