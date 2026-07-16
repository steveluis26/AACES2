from datetime import datetime, date
from typing import List, Optional, Union, TypeVar, Generic, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, validator

from app.schemas.capabilities import DocumentCapabilities

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
    plan: Optional[str] = Field(None, pattern='^(trial|basico|premium|enterprise)$')
    cursos_max: Optional[int] = Field(None, ge=1)
    descuento_pct: Optional[int] = Field(None, ge=0, le=100)

class ClienteResponse(ClienteBase):
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    estado: str
    ultimo_acceso: Optional[datetime] = None
    vigencia_desde: Optional[date] = None
    vigencia_hasta: Optional[date] = None
    plan: str = 'trial'
    cursos_creados: int = 0
    cursos_max: int = 10
    descuento_pct: int = 0

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
    duracion_validacion: Optional[int] = Field(None, ge=1, description="Vigencia del certificado en meses")
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
    duracion_validacion: Optional[int] = Field(None, ge=1, description="Vigencia del certificado en meses")
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

# Template schemas
class TemplateBase(BaseSchema):
    tipo_documento: str = Field(..., pattern='^(CONSTANCIA|DC3|DIPLOMA|CREDENCIAL|OTRO)$')
    nombre: str = Field(..., min_length=1, max_length=200)
    recursos: Optional[Dict[str, Any]] = Field(default_factory=lambda: {
        "logo_url": None, "firma1_url": None, "firma2_url": None,
        "fondo_url": None, "sello_url": None,
    })
    config: Optional[Dict[str, Any]] = Field(default_factory=lambda: {
        "posicion_qr": {"x": 450, "y": 50, "w": 100, "h": 100},
        "tipografia": {"familia": "Arial", "tamano": 12, "color": "#000000"},
        "colores": {"primario": "#1a365d", "secundario": "#2d6bb5", "fondo": "#ffffff"},
        "margenes": {"sup": 20, "inf": 20, "izq": 20, "der": 20},
        "alineacion": "justify",
        "tamano_hoja": "letter",
    })
    html_template: str = ""

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseSchema):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    recursos: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    html_template: Optional[str] = None

class TemplateResponse(TemplateBase):
    id: UUID
    organizacion_id: UUID
    template_group_id: UUID
    version: int
    activa: bool
    fecha_creacion: datetime
    creada_por: Optional[UUID] = None

    model_config = {"from_attributes": True}

class TemplateVersionResponse(BaseSchema):
    id: UUID
    version: int
    nombre: str
    activa: bool
    creada_por: Optional[UUID] = None
    fecha_creacion: datetime

class TemplateActivateRequest(BaseSchema):
    template_id: UUID


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


# Documento schemas
class DocumentoGenerarRequest(BaseSchema):
    template_id: UUID
    data: Dict[str, Any] = Field(default_factory=dict)
    documento_metadata: Optional[Dict[str, Any]] = None


class DocumentoResponse(BaseSchema):
    id: UUID
    organizacion_id: UUID
    template_id: Optional[UUID] = None
    template_version: Optional[int] = None
    tipo_documento: str
    codigo_validacion: str
    pdf_hash: str
    storage_key: str
    estatus: str
    fecha_emision: datetime

    model_config = {"from_attributes": True}


class DocumentoListResponse(BaseSchema):
    id: UUID
    tipo_documento: str
    codigo_validacion: str
    pdf_hash: str
    estatus: str
    fecha_emision: datetime
    documento_metadata: Optional[Dict[str, Any]] = None
    organizacion_razon_social: Optional[str] = None


class DocumentoGenerarResponse(BaseSchema):
    success: bool = True
    documento: DocumentoResponse
    descarga_url: str
    codigo_validacion: str


class EmitirConstanciaRequest(BaseSchema):
    curso_participante_id: str
    template_id: Optional[str] = None


# Verification schemas
class VerificacionPublicResponse(BaseSchema):
    valida: bool
    codigo_validacion: str
    tipo_documento: str
    estatus: str
    fecha_emision: Optional[str] = None
    pdf_hash: Optional[str] = None
    organizacion: Optional[str] = None
    participante: Optional[Dict[str, Any]] = None
    curso: Optional[Dict[str, Any]] = None
    verificaciones_count: int = 0


class VerificacionRegistroResponse(BaseSchema):
    id: UUID
    fecha: datetime
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    tipo: str
    resultado: str


# Constancia detail schemas
class ParticipanteResumen(BaseSchema):
    nombre: str
    correo: Optional[str] = None
    empresa: Optional[str] = None
    puesto: Optional[str] = None


class CursoResumen(BaseSchema):
    nombre: str
    codigo_curso: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    duracion_horas: Optional[int] = None
    modalidad: Optional[str] = None
    ciudad: Optional[str] = None


class OrganizacionResumen(BaseSchema):
    id: UUID
    nombre: str
    nombre_comercial: Optional[str] = None
    logo_url: Optional[str] = None


class ActivoDocumental(BaseSchema):
    pdf_url: str
    hash_sha256: str
    tipo_documento: str


class TemplateInfo(BaseSchema):
    id: Optional[UUID] = None
    nombre: str
    version: int


class VerificacionResumen(BaseSchema):
    id: UUID
    fecha: datetime
    tipo: str
    resultado: str
    ip: Optional[str] = None
    ciudad: Optional[str] = None


class VerificacionesInfo(BaseSchema):
    total: int
    ultima_fecha: Optional[datetime] = None
    ultimas: list[VerificacionResumen] = []


class TimelineEvent(BaseSchema):
    fecha: datetime
    tipo: str
    titulo: str
    descripcion: Optional[str] = None
    metadata: dict = {}


class ConstanciaDetalleResponse(BaseSchema):
    id: UUID
    tipo_documento: str
    estado: str
    codigo_validacion: str
    folio: Optional[str] = None
    fecha_emision: datetime
    fecha_expiracion: Optional[datetime] = None
    participante: ParticipanteResumen
    curso: CursoResumen
    organizacion: OrganizacionResumen
    activo_documental: ActivoDocumental
    template: TemplateInfo
    verificaciones: VerificacionesInfo
    timeline: list[TimelineEvent] = []
    capabilities: DocumentCapabilities = Field(default_factory=DocumentCapabilities)


from app.queries.constancia_list import ConstanciaListQuery

# Constancia list schemas


class ConstanciaResumen(BaseSchema):
    id: UUID
    codigo_validacion: str
    estatus: str
    fecha_emision: datetime
    pdf_hash: str
    participante_nombre: str
    curso_nombre: str
    folio: Optional[str] = None
    verificaciones_count: int = 0
    capabilities: DocumentCapabilities = Field(default_factory=DocumentCapabilities)

    model_config = {"from_attributes": True}


class PaginationInfo(BaseSchema):
    page: int
    page_size: int
    total: int
    total_pages: int


class ConstanciaListMeta(BaseSchema):
    filters_applied: int = 0
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    query_time_ms: float = 0


class ConstanciaListResponse(BaseSchema):
    items: list[ConstanciaResumen]
    pagination: PaginationInfo
    meta: ConstanciaListMeta


class ConstanciaResumenResponse(BaseSchema):
    total: int
    emitidas: int
    canceladas: int
    reemitidas: int
    verificadas: int
    pendientes: int
    tiempo_promedio_horas: Optional[float] = None
