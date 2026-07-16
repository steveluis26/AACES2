from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, Numeric, ForeignKey, Date, CheckConstraint, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Cliente(Base):
    __tablename__ = "clientes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    ciudad_base = Column(String(100))
    categoria = Column(String(20), default='basico', nullable=False)
    estado = Column(String(20), default='activo', nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    fecha_cambio_categoria = Column(DateTime(timezone=True))
    ultimo_acceso = Column(DateTime(timezone=True))
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime(timezone=True))
    acepta_terminos = Column(Boolean, default=False)
    fecha_acepta_terminos = Column(DateTime(timezone=True))
    datos_procesados = Column(Boolean, default=True)
    fecha_eliminacion_logica = Column(DateTime(timezone=True))
    must_change_password = Column(Boolean, default=False)
    vigencia_desde = Column(Date)
    vigencia_hasta = Column(Date)
    plan = Column(String(20), default='trial', nullable=False)
    cursos_creados = Column(Integer, default=0, nullable=False)
    cursos_max = Column(Integer, default=10, nullable=False)
    descuento_pct = Column(Integer, default=0, nullable=False)
    
    # Relationships
    capacitadores = relationship("Capacitador", back_populates="cliente", foreign_keys="Capacitador.cliente_id")
    cursos = relationship("Curso", primaryjoin="Cliente.id == Curso.cliente_id")
    
    __table_args__ = (
        CheckConstraint("categoria IN ('basico', 'premium', 'enterprise')", name="check_categoria"),
        CheckConstraint("estado IN ('activo', 'suspendido', 'eliminado')", name="check_estado_cliente"),
        Index('idx_clientes_correo', 'correo'),
        Index('idx_clientes_categoria', 'categoria'),
        Index('idx_clientes_estado', 'estado'),
        Index('idx_clientes_fecha_creacion', 'fecha_creacion'),
    )

class Capacitador(Base):
    __tablename__ = "capacitadores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(255), unique=True)
    telefono = Column(String(20))
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"))
    fecha_inicio_vigencia = Column(Date)
    fecha_fin_vigencia = Column(Date)
    estado_pago = Column(String(20), default='pendiente')
    acceso_activo = Column(Boolean, default=False)
    documento_identidad = Column(String(50))
    especialidad = Column(String(100))
    nivel_certificacion = Column(String(50))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    creado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    actualizado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    
    # Relationships
    cliente = relationship("Cliente", foreign_keys=[cliente_id], back_populates="capacitadores")
    cursos = relationship("Curso", back_populates="capacitador")
    
    __table_args__ = (
        CheckConstraint("estado_pago IN ('pagado', 'vencido', 'pendiente', 'cancelado')", name="check_estado_pago"),
        Index('idx_capacitadores_cliente_id', 'cliente_id'),
        Index('idx_capacitadores_correo', 'correo'),
        Index('idx_capacitadores_estado_pago', 'estado_pago'),
        Index('idx_capacitadores_acceso_activo', 'acceso_activo'),
    )

class Curso(Base):
    __tablename__ = "cursos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"))
    codigo_curso = Column(String(20), unique=True, nullable=False)
    nombre = Column(String(200), nullable=False)
    ciudad = Column(String(100), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    duracion_horas = Column(Integer, nullable=False)
    modalidad = Column(String(20))
    capacitador_id = Column(UUID(as_uuid=True), ForeignKey("capacitadores.id"))
    duracion_validacion = Column(Integer)  # en meses
    costo_total = Column(Numeric(10, 2))
    moneda = Column(String(3), default='MXN')
    estado = Column(String(20), default='activo')
    empresa_contratante = Column(String(200))
    descripcion = Column(Text)
    objetivos = Column(Text)
    requisitos = Column(Text)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    creado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    actualizado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    
    # Relationships
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    capacitador = relationship("Capacitador", back_populates="cursos")
    participantes = relationship("CursoParticipante", back_populates="curso")
    
    __table_args__ = (
        CheckConstraint("duracion_horas > 0", name="check_duracion_horas"),
        CheckConstraint("modalidad IN ('presencial', 'virtual', 'mixta')", name="check_modalidad"),
        CheckConstraint("estado IN ('activo', 'finalizado', 'en_espera', 'cancelado')", name="check_estado_curso"),
        Index('idx_cursos_cliente_id', 'cliente_id'),
        Index('idx_cursos_codigo_curso', 'codigo_curso'),
        Index('idx_cursos_fechas', 'fecha_inicio', 'fecha_fin'),
        Index('idx_cursos_estado', 'estado'),
        Index('idx_cursos_ciudad', 'ciudad'),
        Index('idx_cursos_capacitador_id', 'capacitador_id'),
    )

class Participante(Base):
    __tablename__ = "participantes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100))
    nombres = Column(String(200))
    apellido_paterno = Column(String(100))
    apellido_materno = Column(String(100))
    correo = Column(String(255))
    telefono = Column(String(20))
    ciudad_origen = Column(String(100))
    fecha_nacimiento = Column(Date)
    genero = Column(String(10))
    empresa = Column(String(200))
    cargo = Column(String(100))
    nivel_educacion = Column(String(50))
    direccion = Column(Text)
    codigo_postal = Column(String(20))
    pais = Column(String(50), default='Mexico')
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    cursos = relationship("CursoParticipante", back_populates="participante")
    
    __table_args__ = (
        CheckConstraint("genero IN ('M', 'F', 'Otro')", name="check_genero"),
        Index('idx_participantes_correo', 'correo'),
        Index('idx_participantes_nombre', 'nombre', 'apellido'),
        Index('idx_participantes_nombres_apellidos', 'nombres', 'apellido_paterno', 'apellido_materno'),
    )

class CursoParticipante(Base):
    __tablename__ = "curso_participante"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    curso_id = Column(UUID(as_uuid=True), ForeignKey("cursos.id", ondelete="CASCADE"))
    participante_id = Column(UUID(as_uuid=True), ForeignKey("participantes.id", ondelete="CASCADE"))
    estado_pago = Column(String(20))
    valor_pagado = Column(Numeric(10, 2), default=0)
    fecha_pago = Column(DateTime(timezone=True))
    fecha_participacion = Column(Date)
    fecha_inicio_vigencia = Column(Date)
    fecha_expiracion = Column(Date)
    id_certificado = Column(String(50), unique=True)
    codigo_validacion = Column(String(20), unique=True)
    estado_acreditacion = Column(Boolean, default=False)
    calificacion = Column(Numeric(5, 2))
    asistencia = Column(Numeric(5, 2), default=0)
    observaciones = Column(Text)
    certificado_url = Column(Text)
    fecha_emision_certificado = Column(DateTime(timezone=True))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    creado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    actualizado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    
    # Relationships
    curso = relationship("Curso", back_populates="participantes")
    participante = relationship("Participante", back_populates="cursos")
    pagos = relationship("Pago", back_populates="curso_participante")
    validaciones = relationship("ValidacionPublica", back_populates="curso_participante")
    
    __table_args__ = (
        CheckConstraint("estado_pago IN ('pagado', 'anticipo', 'pendiente', 'cancelado')", name="check_estado_pago_cp"),
        CheckConstraint("calificacion >= 0 AND calificacion <= 100", name="check_calificacion"),
        CheckConstraint("asistencia >= 0 AND asistencia <= 100", name="check_asistencia"),
        UniqueConstraint('curso_id', 'participante_id', name='uq_curso_participante'),
        Index('idx_curso_participante_curso_id', 'curso_id'),
        Index('idx_curso_participante_participante_id', 'participante_id'),
        Index('idx_curso_participante_certificado', 'id_certificado'),
        Index('idx_curso_participante_validacion', 'codigo_validacion'),
        Index('idx_curso_participante_estado_acreditacion', 'estado_acreditacion'),
        Index('idx_curso_participante_fechas', 'fecha_inicio_vigencia', 'fecha_expiracion'),
    )

class Pago(Base):
    __tablename__ = "pagos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    curso_participante_id = Column(UUID(as_uuid=True), ForeignKey("curso_participante.id", ondelete="CASCADE"))
    tipo_pago = Column(String(30))
    monto = Column(Numeric(10, 2), nullable=False)
    moneda = Column(String(3), default='MXN')
    metodo_pago = Column(String(50))
    referencia_pago = Column(String(100))
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())
    estado_pago = Column(String(20), default='completado')
    comprobante_url = Column(Text)
    notas = Column(Text)
    creado_por = Column(UUID(as_uuid=True), ForeignKey("clientes.id"))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    curso_participante = relationship("CursoParticipante", back_populates="pagos")
    
    __table_args__ = (
        CheckConstraint("tipo_pago IN ('participante', 'capacitador', 'curso_completo')", name="check_tipo_pago"),
        CheckConstraint("metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'paypal', 'otro')", name="check_metodo_pago"),
        CheckConstraint("estado_pago IN ('pendiente', 'completado', 'fallido', 'reembolsado')", name="check_estado_pago_pago"),
        Index('idx_pagos_cliente_id', 'cliente_id'),
        Index('idx_pagos_curso_participante_id', 'curso_participante_id'),
        Index('idx_pagos_fecha_pago', 'fecha_pago'),
        Index('idx_pagos_estado', 'estado_pago'),
    )

class ValidacionPublica(Base):
    __tablename__ = "validaciones_publicas"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo_validacion = Column(String(20), ForeignKey("curso_participante.codigo_validacion"))
    fecha_validacion = Column(DateTime(timezone=True), server_default=func.now())
    ip_validacion = Column(INET)
    user_agent = Column(Text)
    resultado = Column(Boolean, default=True)
    intentos = Column(Integer, default=1)
    
    # Relationships
    curso_participante = relationship("CursoParticipante", back_populates="validaciones")
    
    __table_args__ = (
        UniqueConstraint('codigo_validacion', 'ip_validacion', name='uq_validacion_ip'),
        Index('idx_validaciones_codigo', 'codigo_validacion'),
        Index('idx_validaciones_fecha', 'fecha_validacion'),
    )

class AuditoriaCambio(Base):
    __tablename__ = "auditoria_cambios"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tabla_nombre = Column(String(50))
    operacion = Column(String(10))
    usuario_id = Column(UUID(as_uuid=True))
    fecha_cambio = Column(DateTime(timezone=True), server_default=func.now())
    datos_anteriores = Column(JSONB)
    datos_nuevos = Column(JSONB)
    
    __table_args__ = (
        Index('idx_auditoria_tabla', 'tabla_nombre'),
        Index('idx_auditoria_usuario', 'usuario_id'),
        Index('idx_auditoria_fecha', 'fecha_cambio'),
    )


class Plan(Base):
    __tablename__ = "planes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(50), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    precio_mensual = Column(Numeric(10, 2), default=0)
    precio_anual = Column(Numeric(10, 2), default=0)
    cursos_max = Column(Integer, default=10)
    usuarios_max = Column(Integer, default=1)
    constancias_max = Column(Integer, default=50)
    incluye_marketplace = Column(Boolean, default=False)
    incluye_api = Column(Boolean, default=False)
    incluye_white_label = Column(Boolean, default=False)
    incluye_soporte_prioritario = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_planes_codigo', 'codigo'),
        Index('idx_planes_activo', 'activo'),
    )


class Organizacion(Base):
    __tablename__ = "organizaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfc = Column(String(13), unique=True, nullable=False)
    razon_social = Column(String(200), nullable=False)
    nombre_comercial = Column(String(200))
    email_contacto = Column(String(255))
    telefono = Column(String(20))
    estado = Column(String(100))
    ciudad = Column(String(100))
    direccion = Column(Text)
    estatus = Column(String(30), default='pendiente', nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_activacion = Column(DateTime(timezone=True))
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notas_admin = Column(Text)

    usuarios = relationship("Usuario", back_populates="organizacion", foreign_keys="Usuario.organizacion_id")
    suscripciones = relationship("Suscripcion", back_populates="organizacion")

    __table_args__ = (
        CheckConstraint("estatus IN ('pendiente', 'activa', 'suspendida', 'cancelada')", name="check_estatus_org"),
        Index('idx_organizaciones_rfc', 'rfc'),
        Index('idx_organizaciones_estatus', 'estatus'),
        Index('idx_organizaciones_fecha_creacion', 'fecha_creacion'),
    )


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizacion_id = Column(UUID(as_uuid=True), ForeignKey("organizaciones.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(30), default='admin', nullable=False)
    telefono = Column(String(20))
    activo = Column(Boolean, default=True)
    ultimo_acceso = Column(DateTime(timezone=True))
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime(timezone=True))
    must_change_password = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organizacion = relationship("Organizacion", foreign_keys=[organizacion_id], back_populates="usuarios")

    __table_args__ = (
        UniqueConstraint('organizacion_id', 'correo', name='uq_org_correo'),
        CheckConstraint("rol IN ('admin', 'capacitador', 'operador')", name="check_rol_usuario"),
        Index('idx_usuarios_org_id', 'organizacion_id'),
        Index('idx_usuarios_correo', 'correo'),
        Index('idx_usuarios_activo', 'activo'),
    )


class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizacion_id = Column(UUID(as_uuid=True), ForeignKey("organizaciones.id", ondelete="CASCADE"), nullable=False)
    template_group_id = Column(UUID(as_uuid=True), nullable=False)
    tipo_documento = Column(String(30), nullable=False)
    version = Column(Integer, nullable=False)
    nombre = Column(String(200), nullable=False)
    activa = Column(Boolean, default=False)
    recursos = Column(JSONB, default=dict)
    config = Column(JSONB, default=dict)
    html_template = Column(Text, default="")
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    creada_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))

    __table_args__ = (
        UniqueConstraint('organizacion_id', 'template_group_id', 'version', name='uq_template_version'),
        CheckConstraint("tipo_documento IN ('CONSTANCIA', 'DC3', 'DIPLOMA', 'CREDENCIAL', 'OTRO')", name="check_tipo_documento"),
        Index('idx_templates_org_tipo', 'organizacion_id', 'tipo_documento'),
        Index('idx_templates_org_activa', 'organizacion_id', 'activa'),
        Index('idx_templates_group_id', 'template_group_id'),
    )


class Suscripcion(Base):
    __tablename__ = "suscripciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizacion_id = Column(UUID(as_uuid=True), ForeignKey("organizaciones.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("planes.id"), nullable=False)
    estatus = Column(String(30), default='pendiente', nullable=False)
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    cursos_max = Column(Integer)
    usuarios_max = Column(Integer)
    constancias_max = Column(Integer)
    metodo_pago = Column(String(50))
    referencia_pago = Column(String(100))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    activada_por = Column(UUID(as_uuid=True))

    organizacion = relationship("Organizacion", foreign_keys=[organizacion_id], back_populates="suscripciones")
    plan = relationship("Plan")

    __table_args__ = (
        CheckConstraint("estatus IN ('pendiente', 'activa', 'expirada', 'cancelada')", name="check_estatus_suscripcion"),
        Index('idx_suscripciones_org_id', 'organizacion_id'),
        Index('idx_suscripciones_plan_id', 'plan_id'),
        Index('idx_suscripciones_estatus', 'estatus'),
        Index('idx_suscripciones_fechas', 'fecha_inicio', 'fecha_fin'),
    )


class RegistroIntento(Base):
    __tablename__ = "registro_intentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfc = Column(String(13))
    correo = Column(String(255))
    ip_origen = Column(String(45))
    user_agent = Column(Text)
    resultado = Column(String(20))
    detalle = Column(Text)
    fecha = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("resultado IN ('exito', 'duplicado', 'bloqueado', 'error')", name="check_resultado_intento"),
        Index('idx_intentos_rfc', 'rfc'),
        Index('idx_intentos_correo', 'correo'),
        Index('idx_intentos_fecha', 'fecha'),
        Index('idx_intentos_resultado', 'resultado'),
    )
