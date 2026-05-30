from datetime import datetime, date
from typing import List, Optional, Union, TypeVar, Generic, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, validator

# Base schema
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True  # Updated for Pydantic v2
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

# Cliente schemas
class ClienteBase(BaseSchema):
    nombre: str = Field(..., min_length=1, max_length=100)
    correo: EmailStr
    ciudad_base: Optional[str] = Field(None, max_length=100)
    categoria: str = Field('basico', pattern='^(basico|premium|enterprise)$')
    
class ClienteCreate(ClienteBase):
    password: str = Field(..., min_length=8, max_length=100)
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v

class ClienteUpdate(BaseSchema):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    correo: Optional[EmailStr] = None
    ciudad_base: Optional[str] = Field(None, max_length=100)
    categoria: Optional[str] = Field(None, pattern='^(basico|premium|enterprise)$')
    estado: Optional[str] = Field(None, pattern='^(activo|suspendido|eliminado)$')

class ClienteResponse(ClienteBase):
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    estado: str
    ultimo_acceso: Optional[datetime] = None
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None

# Capacitador schemas
class CapacitadorBase(BaseSchema):
    nombre: str = Field(..., min_length=1, max_length=100)
    correo: EmailStr
    telefono: Optional[str] = Field(None, max_length=20)
    especialidad: str = Field(..., min_length=1, max_length=100)
    experiencia_anos: int = Field(..., ge=0)
    estado: str = Field('activo', pattern='^(activo|inactivo)$')

class CapacitadorCreate(CapacitadorBase):
    pass

class CapacitadorUpdate(BaseSchema):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    correo: Optional[EmailStr] = None
    telefono: Optional[str] = Field(None, max_length=20)
    especialidad: Optional[str] = Field(None, min_length=1, max_length=100)
    experiencia_anos: Optional[int] = Field(None, ge=0)
    estado: Optional[str] = Field(None, pattern='^(activo|inactivo)$')

class CapacitadorResponse(CapacitadorBase):
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime

# Curso schemas
class CursoBase(BaseSchema):
    titulo: str = Field(..., min_length=1, max_length=200)
    descripcion: str = Field(..., min_length=1, max_length=1000)
    categoria: str = Field(..., min_length=1, max_length=100)
    duracion_horas: int = Field(..., ge=1)
    costo: float = Field(..., ge=0)
    fecha_inicio: date
    fecha_fin: date
    ciudad: str = Field(..., min_length=1, max_length=100)
    modalidad: str = Field(..., pattern='^(presencial|virtual|mixta)$')
    capacitador_id: UUID
    estado: str = Field('activo', pattern='^(activo|finalizado|en_espera|cancelado)$')

class CursoCreate(CursoBase):
    pass

class CursoUpdate(BaseSchema):
    titulo: Optional[str] = Field(None, min_length=1, max_length=200)
    descripcion: Optional[str] = Field(None, min_length=1, max_length=1000)
    categoria: Optional[str] = Field(None, min_length=1, max_length=100)
    duracion_horas: Optional[int] = Field(None, ge=1)
    costo: Optional[float] = Field(None, ge=0)
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    ciudad: Optional[str] = Field(None, min_length=1, max_length=100)
    modalidad: Optional[str] = Field(None, pattern='^(presencial|virtual|mixta)$')
    capacitador_id: Optional[UUID] = None
    estado: Optional[str] = Field(None, pattern='^(activo|finalizado|en_espera|cancelado)$')

class CursoResponse(CursoBase):
    id: UUID
    codigo_curso: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    numero_participantes: int = 0
    cupo_disponible: int = 0

# Participante schemas
class ParticipanteBase(BaseSchema):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    nombres: Optional[str] = Field(None, min_length=1, max_length=200)
    apellido_paterno: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido_materno: Optional[str] = Field(None, min_length=1, max_length=100)
    correo: EmailStr
    telefono: Optional[str] = Field(None, max_length=20)
    fecha_nacimiento: date
    genero: Optional[str] = Field(None, pattern='^(M|F|Otro)$')
    ciudad: str = Field(..., min_length=1, max_length=100)
    cliente_id: UUID

class ParticipanteCreate(ParticipanteBase):
    pass

class ParticipanteUpdate(BaseSchema):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido: Optional[str] = Field(None, min_length=1, max_length=100)
    nombres: Optional[str] = Field(None, min_length=1, max_length=200)
    apellido_paterno: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido_materno: Optional[str] = Field(None, min_length=1, max_length=100)
    correo: Optional[EmailStr] = None
    telefono: Optional[str] = Field(None, max_length=20)
    fecha_nacimiento: Optional[date] = None
    genero: Optional[str] = Field(None, pattern='^(M|F|Otro)$')
    ciudad: Optional[str] = Field(None, min_length=1, max_length=100)

class ParticipanteResponse(ParticipanteBase):
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    profesion: Optional[str] = Field(None, alias='nivel_educacion')

# CursoParticipante schemas
class CursoParticipanteBase(BaseSchema):
    curso_id: UUID
    participante_id: UUID
    fecha_inscripcion: datetime = Field(default_factory=datetime.utcnow)
    estado_pago: str = Field('pendiente', pattern='^(pagado|anticipo|pendiente|cancelado)$')
    monto_pagado: float = Field(0.0, ge=0)
    nota_final: Optional[float] = Field(None, ge=0, le=10)
    porcentaje_asistencia: Optional[float] = Field(None, ge=0, le=100)
    acreditado: bool = False
    fecha_emision_certificado: Optional[datetime] = None
    fecha_expiracion_certificado: Optional[datetime] = None

class CursoParticipanteCreate(CursoParticipanteBase):
    pass

class CursoParticipanteUpdate(BaseSchema):
    estado_pago: Optional[str] = Field(None, pattern='^(pagado|anticipo|pendiente|cancelado)$')
    monto_pagado: Optional[float] = Field(None, ge=0)
    nota_final: Optional[float] = Field(None, ge=0, le=10)
    porcentaje_asistencia: Optional[float] = Field(None, ge=0, le=100)
    acreditado: Optional[bool] = None
    fecha_emision_certificado: Optional[datetime] = None
    fecha_expiracion_certificado: Optional[datetime] = None

class CursoParticipanteResponse(CursoParticipanteBase):
    id: UUID
    codigo_validacion: Optional[str] = None
    id_certificado: Optional[str] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime

# Pago schemas
class PagoBase(BaseSchema):
    curso_participante_id: UUID
    cliente_id: UUID
    monto: float = Field(..., gt=0)
    tipo_pago: str = Field(..., pattern='^(participante|capacitador|curso_completo)$')
    metodo_pago: str = Field(..., pattern='^(efectivo|transferencia|tarjeta|paypal|otro)$')
    fecha_pago: datetime = Field(default_factory=datetime.utcnow)
    estado_pago: str = Field('completado', pattern='^(pendiente|completado|fallido|reembolsado)$')
    referencia_pago: Optional[str] = Field(None, max_length=100)
    notas: Optional[str] = Field(None, max_length=500)

class PagoCreate(PagoBase):
    pass

class PagoUpdate(BaseSchema):
    monto: Optional[float] = Field(None, gt=0)
    tipo_pago: Optional[str] = Field(None, pattern='^(participante|capacitador|curso_completo)$')
    metodo_pago: Optional[str] = Field(None, pattern='^(efectivo|transferencia|tarjeta|paypal|otro)$')
    fecha_pago: Optional[datetime] = None
    estado_pago: Optional[str] = Field(None, pattern='^(pendiente|completado|fallido|reembolsado)$')
    referencia_pago: Optional[str] = Field(None, max_length=100)
    notas: Optional[str] = Field(None, max_length=500)

class PagoResponse(PagoBase):
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime

# Authentication schemas
class Token(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenData(BaseSchema):
    correo: Optional[str] = None

class LoginRequest(BaseSchema):
    correo: EmailStr
    password: str = Field(..., min_length=1)

class PasswordResetRequest(BaseSchema):
    correo: EmailStr

class PasswordResetConfirm(BaseSchema):
    token: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v

# Validation schemas
class ValidacionRequest(BaseSchema):
    codigo_validacion: str = Field(..., min_length=1, max_length=20)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class ValidacionResponse(BaseSchema):
    valido: bool
    mensaje: str
    certificado: Optional[Dict[str, Any]] = None

class ValidacionPublicaResponse(BaseSchema):
    id: UUID
    codigo_validacion: str
    fecha_validacion: datetime
    resultado: bool
    intentos: int

# Pagination schemas
T = TypeVar('T')

class PaginatedResponse(BaseSchema, Generic[T]):
    items: List[T] = []
    total: int
    skip: int = 0
    limit: int = 10

# Error schemas
class ErrorResponse(BaseSchema):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Success schemas
class SuccessResponse(BaseSchema):
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None
