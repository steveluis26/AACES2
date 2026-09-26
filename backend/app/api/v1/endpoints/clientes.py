from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from typing import List, Optional
import uuid
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel

from app.core.cifrado import cifrar, descifrar, indice
from app.services import cupo as cupo_service
from app.core.database import get_db
from app.models import Cliente, Capacitador, Curso, Participante, CursoParticipante, Pago
from app.schemas import (
    ClienteResponse, ClienteCreate, ClienteUpdate,
    CapacitadorResponse, CapacitadorCreate, CapacitadorUpdate,
    CursoResponse, CursoCreate, CursoUpdate,
    ParticipanteResponse, ParticipanteCreate, ParticipanteUpdate,
    CursoParticipanteResponse, CursoParticipanteCreate, CursoParticipanteUpdate,
    PagoResponse, PagoCreate, PagoUpdate,
    PaginatedResponse, ValidacionResponse
)
from app.core.identity import get_current_identity, get_current_cliente_id, require_platform_identity, require_org_id, Identity
from sqlalchemy import text
from app.services.security import security_service
from app.services.email import email_service
from app.services.validation import validation_service
from app.core.logging import audit_logger


# Campos que una organización puede editar de su propia ficha.
# Plan, categoría, límites y estado solo los toca la plataforma.
CLIENTE_CAMPOS_PROPIOS = {"nombre", "correo", "ciudad_base"}


async def _own_cliente_id(db: AsyncSession, identity: Identity) -> str | None:
    """Devuelve el cliente_id propio de la organización del usuario (vía puente
    clientes.organizacion_id). None para plataforma (acceso total) o si no hay
    fila vinculada."""
    if identity.source == "plataforma":
        return None
    if not identity.org_id:
        return None
    row = await db.execute(
        text("SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id ORDER BY fecha_creacion LIMIT 1"),
        {"org_id": identity.org_id},
    )
    rec = row.fetchone()
    return str(rec[0]) if rec else None


def _exigir_acceso_cliente(cliente_id: UUID, own_cliente_id: str | None, identity: Identity) -> None:
    """403 si el usuario no es plataforma y el recurso no es de su organización."""
    if identity.source == "plataforma":
        return
    if own_cliente_id is None or str(cliente_id) != own_cliente_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este recurso")


async def _exigir_cp_propio(db: AsyncSession, identity: Identity, cp_id: str) -> None:
    """404 si el curso_participante no existe o no pertenece a la organización."""
    if identity.source == "plataforma":
        return
    cid = await get_current_cliente_id(db, identity)
    row = await db.execute(
        text("""
            SELECT 1 FROM aaces.curso_participante cp
            JOIN aaces.cursos c ON c.id = cp.curso_id
            WHERE cp.id = :cp AND c.cliente_id = :cid
        """),
        {"cp": cp_id, "cid": cid},
    )
    if row.scalar() is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
from app.core.config import settings
import io
import csv
import json

router = APIRouter()

# =============================================================================
# CLIENTES ENDPOINTS
# =============================================================================

class SubcursoCreate(BaseModel):
    nombre: str
    ciudad: str
    empresa_contratante: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    duracion_horas: Optional[int] = 8

class ConstanciaCreate(BaseModel):
    nombre: str
    norma: Optional[str] = None

class CursoCreatePayload(BaseModel):
    nombre: str
    ciudad: Optional[str] = None
    empresa_contratante: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    duracion_horas: Optional[int] = 8
    subcursos: Optional[List[SubcursoCreate]] = None
    constancias: Optional[List[ConstanciaCreate]] = None
    grupo_id: Optional[str] = None
    precio_base: Optional[float] = None
    precio_promocional: Optional[float] = None
    vigencia_meses: Optional[int] = None
    modalidad: Optional[str] = 'presencial'
    catalogo_curso_id: Optional[str] = None

@router.get("/clientes", response_model=PaginatedResponse[ClienteResponse])
async def get_clientes(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    categoria: Optional[str] = Query(None, pattern="^(basico|premium|enterprise)$"),
    estado: Optional[str] = Query(None, pattern="^(activo|suspendido|eliminado)$"),
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(require_platform_identity)
):
    """Obtener lista de clientes con filtros y paginación. Solo plataforma."""
    try:
        # Construir consulta base
        query = select(Cliente)
        
        # Aplicar filtros
        if search:
            query = query.where(
                or_(
                    Cliente.nombre.ilike(f"%{search}%"),
                    Cliente.correo.ilike(f"%{search}%"),
                    Cliente.ciudad_base.ilike(f"%{search}%")
                )
            )
        
        if categoria:
            query = query.where(Cliente.categoria == categoria)
        
        if estado:
            query = query.where(Cliente.estado == estado)
        
        # Obtener total
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        # Aplicar paginación
        query = query.offset(skip).limit(limit)
        
        # Ejecutar consulta
        result = await db.execute(query)
        clientes = result.scalars().all()
        
        return PaginatedResponse(
            items=list(clientes),
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener clientes: {str(e)}")

@router.post("/clientes", response_model=ClienteResponse)
async def create_cliente(
    cliente: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(require_platform_identity)
):
    """Crear un nuevo cliente. Solo plataforma (el registro público es /auth/register)."""
    try:
        # Verificar si el correo ya existe
        existing_cliente = await db.execute(
            select(Cliente).where(Cliente.correo == cliente.correo)
        )
        if existing_cliente.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Ya existe un cliente con este correo electrónico"
            )
        
        # Encriptar contraseña
        hashed_password = security_service.hash_password(cliente.password)
        
        # Crear cliente
        db_cliente = Cliente(
            nombre=cliente.nombre,
            correo=cliente.correo,
            password_hash=hashed_password,
            ciudad_base=cliente.ciudad_base,
            categoria=cliente.categoria
        )
        
        db.add(db_cliente)
        await db.commit()
        await db.refresh(db_cliente)
        
        # Registrar auditoría
        audit_logger.log_cliente_creation(db_cliente.id, "Sistema")
        
        return db_cliente
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear cliente: {str(e)}")

@router.get("/clientes/{cliente_id}", response_model=ClienteResponse)
async def get_cliente(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Obtener un cliente por ID (solo plataforma o la propia organización)."""
    try:
        own = await _own_cliente_id(db, identity)
        _exigir_acceso_cliente(cliente_id, own, identity)
        result = await db.execute(
            select(Cliente).where(Cliente.id == cliente_id)
        )
        cliente = result.scalar_one_or_none()

        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        return cliente
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener cliente: {str(e)}")

@router.put("/clientes/{cliente_id}", response_model=ClienteResponse)
async def update_cliente(
    cliente_id: UUID,
    cliente: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Actualizar un cliente.

    La plataforma puede editar todo. Una organización solo su propia ficha y
    únicamente campos no privilegiados (nombre, correo, ciudad_base):
    plan, categoría, límites y estado son exclusivos de plataforma.
    """
    try:
        own = await _own_cliente_id(db, identity)
        _exigir_acceso_cliente(cliente_id, own, identity)

        update_data = cliente.dict(exclude_unset=True)
        if identity.source != "plataforma":
            privilegiados = [f for f in update_data if f not in CLIENTE_CAMPOS_PROPIOS]
            if privilegiados:
                raise HTTPException(
                    status_code=403,
                    detail=f"Solo la plataforma puede modificar: {', '.join(privilegiados)}"
                )

        result = await db.execute(
            select(Cliente).where(Cliente.id == cliente_id)
        )
        db_cliente = result.scalar_one_or_none()

        if not db_cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        # Actualizar campos
        for field, value in update_data.items():
            setattr(db_cliente, field, value)

        await db.commit()
        await db.refresh(db_cliente)

        # Registrar auditoría
        audit_logger.log_cliente_update(cliente_id, identity.user_id)

        return db_cliente
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar cliente: {str(e)}")

@router.delete("/clientes/{cliente_id}")
async def delete_cliente(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Eliminar un cliente (soft delete). Solo plataforma."""
    try:
        if identity.source != "plataforma":
            raise HTTPException(status_code=403, detail="Solo la plataforma puede eliminar clientes")
        result = await db.execute(
            select(Cliente).where(Cliente.id == cliente_id)
        )
        db_cliente = result.scalar_one_or_none()

        if not db_cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        # Soft delete
        db_cliente.estado = "eliminado"
        db_cliente.fecha_eliminacion_logica = func.now()

        await db.commit()

        # Registrar auditoría
        audit_logger.log_cliente_deletion(cliente_id, identity.user_id)

        return {"message": "Cliente eliminado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar cliente: {str(e)}")

# =============================================================================
# CAPACITADORES ENDPOINTS
# =============================================================================

@router.get("/capacitadores", response_model=PaginatedResponse[CapacitadorResponse])
async def get_capacitadores(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    especialidad: Optional[str] = Query(None, max_length=50),
    estado: Optional[str] = Query(None, pattern="^(activo|inactivo)$"),
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Obtener lista de capacitadores (solo los de la propia organización)."""
    try:
        query = select(Capacitador)
        if identity.source != "plataforma":
            cid = await get_current_cliente_id(db, identity)
            query = query.where(Capacitador.cliente_id == cid)

        if search:
            query = query.where(
                or_(
                    Capacitador.nombre.ilike(f"%{search}%"),
                    Capacitador.correo.ilike(f"%{search}%"),
                    Capacitador.especialidad.ilike(f"%{search}%")
                )
            )
        
        if especialidad:
            query = query.where(Capacitador.especialidad == especialidad)
        
        if estado:
            query = query.where(Capacitador.estado == estado)
        
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        capacitadores = result.scalars().all()
        
        return PaginatedResponse(
            items=list(capacitadores),
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener capacitadores: {str(e)}")

@router.post("/capacitadores", response_model=CapacitadorResponse)
async def create_capacitador(
    capacitador: CapacitadorCreate,
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Crear un nuevo capacitador (vinculado a la organización)."""
    try:
        data = capacitador.dict()
        if identity.source != "plataforma":
            data["cliente_id"] = await get_current_cliente_id(db, identity)
        # Verificar si el correo ya existe
        existing_capacitador = await db.execute(
            select(Capacitador).where(Capacitador.correo == capacitador.correo)
        )
        if existing_capacitador.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Ya existe un capacitador con este correo electrónico"
            )

        db_capacitador = Capacitador(**data)
        db.add(db_capacitador)
        await db.commit()
        await db.refresh(db_capacitador)

        audit_logger.log_capacitador_creation(db_capacitador.id, identity.user_id)

        return db_capacitador
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear capacitador: {str(e)}")

# =============================================================================
# CURSOS ENDPOINTS
# =============================================================================

@router.get("/cursos", response_model=PaginatedResponse[CursoResponse])
async def get_cursos(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    modalidad: Optional[str] = Query(None, pattern="^(presencial|virtual|mixta)$"),
    estado: Optional[str] = Query(None, pattern="^(activo|finalizado|en_espera|cancelado)$"),
    fecha_inicio_from: Optional[date] = Query(None),
    fecha_inicio_to: Optional[date] = Query(None),
    capacitador_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Obtener lista de cursos con filtros avanzados (solo los de la propia organización)."""
    try:
        query = select(Curso)
        if identity.source != "plataforma":
            cid = await get_current_cliente_id(db, identity)
            query = query.where(Curso.cliente_id == cid)

        if search:
            query = query.where(
                or_(
                    Curso.nombre.ilike(f"%{search}%"),
                    Curso.descripcion.ilike(f"%{search}%"),
                )
            )
        
        if modalidad:
            query = query.where(Curso.modalidad == modalidad)
        
        if estado:
            query = query.where(Curso.estado == estado)
        
        if fecha_inicio_from:
            query = query.where(Curso.fecha_inicio >= fecha_inicio_from)
        
        if fecha_inicio_to:
            query = query.where(Curso.fecha_inicio <= fecha_inicio_to)
        
        if capacitador_id:
            query = query.where(Curso.capacitador_id == capacitador_id)
        
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        cursos = result.scalars().all()
        
        return PaginatedResponse(
            items=list(cursos),
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener cursos: {str(e)}")

# =============================================================================
# PARTICIPANTES ENDPOINTS
# =============================================================================

@router.get("/participantes", response_model=PaginatedResponse[ParticipanteResponse])
async def get_participantes(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    cliente_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Obtener lista de participantes (solo los de la propia organización)."""
    try:
        query = select(Participante)
        if identity.source != "plataforma":
            cid = await get_current_cliente_id(db, identity)
            query = query.where(Participante.cliente_id == cid)

        if search:
            query = query.where(
                or_(
                    Participante.nombre.ilike(f"%{search}%"),
                    Participante.apellido.ilike(f"%{search}%"),
                    Participante.apellido_paterno.ilike(f"%{search}%"),
                    Participante.apellido_materno.ilike(f"%{search}%"),
                    Participante.correo.ilike(f"%{search}%")
                )
            )
        
        if cliente_id:
            if identity.source != "plataforma":
                raise HTTPException(status_code=403, detail="No puedes filtrar por otra organización")
            query = query.where(Participante.cliente_id == cliente_id)
        
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        participantes = result.scalars().all()
        
        return PaginatedResponse(
            items=list(participantes),
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener participantes: {str(e)}")

# =============================================================================
# VALIDACIÓN PÚBLICA DE CERTIFICADOS
# =============================================================================

@router.get("/validar-certificado/{codigo_validacion}", response_model=ValidacionResponse)
async def validar_certificado(
    codigo_validacion: str,
    db: AsyncSession = Depends(get_db)
):
    """Validar un certificado públicamente usando su código de validación."""
    try:
        await db.execute(text("SET LOCAL search_path TO aaces"))
        # Buscar el curso_participante con el código de validación
        result = await db.execute(
            select(CursoParticipante).where(
                CursoParticipante.codigo_validacion == codigo_validacion
            )
        )
        curso_participante = result.scalar_one_or_none()
        
        if not curso_participante:
            return ValidacionResponse(
                valido=False,
                mensaje="Certificado no encontrado"
            )
        
        # Verificar si está acreditado
        if not curso_participante.estado_acreditacion:
            return ValidacionResponse(
                valido=False,
                mensaje="El participante no está acreditado para este curso"
            )
        
        # Verificar si el certificado está vigente
        if curso_participante.fecha_expiracion:
            from datetime import datetime
            if datetime.now().date() > curso_participante.fecha_expiracion:
                return ValidacionResponse(
                    valido=False,
                    mensaje="El certificado ha expirado"
                )
        
        # Obtener información adicional
        curso_result = await db.execute(
            select(Curso).where(Curso.id == curso_participante.curso_id)
        )
        curso = curso_result.scalar_one_or_none()
        
        from sqlalchemy import text
        p_res = await db.execute(text("SELECT nombre, apellido FROM participantes WHERE id = :id LIMIT 1"), {"id": curso_participante.participante_id})
        p_row = p_res.fetchone()
        
        return ValidacionResponse(
            valido=True,
            mensaje="Certificado válido",
            certificado={
                "codigo_validacion": curso_participante.codigo_validacion,
                "participante_nombre": (f"{p_row[0] or ''} {p_row[1] or ''}").strip() if p_row else None,
                "curso_titulo": curso.nombre if curso else None,
                "curso_fecha": curso.fecha_inicio if curso else None,
                "fecha_emision": curso_participante.fecha_emision_certificado,
                "fecha_expiracion": curso_participante.fecha_expiracion,
                "nota_final": float(curso_participante.calificacion) if getattr(curso_participante, "calificacion", None) is not None else None
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al validar certificado: {str(e)}")

# =============================================================================
# REPORTES Y ESTADÍSTICAS
# =============================================================================

@router.get("/estadisticas/dashboard")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    identity: Identity = Depends(get_current_identity)
):
    """Obtener estadísticas para el dashboard (solo de la propia organización)."""
    try:
        es_plataforma = identity.source == "plataforma"
        cid = None if es_plataforma else await get_current_cliente_id(db, identity)

        def con_tenant(q, modelo):
            if es_plataforma:
                return q
            return q.where(modelo.cliente_id == cid)

        # Total clientes
        if es_plataforma:
            clientes_total = await db.execute(select(func.count(Cliente.id)))
            clientes_activos = await db.execute(
                select(func.count(Cliente.id)).where(Cliente.estado == "activo")
            )
            total_clientes = clientes_total.scalar()
            total_clientes_activos = clientes_activos.scalar()
        else:
            total_clientes = 1
            total_clientes_activos = 1

        # Total cursos
        cursos_total = await db.execute(con_tenant(select(func.count(Curso.id)), Curso))
        total_cursos = cursos_total.scalar()

        # Cursos activos
        cursos_activos = await db.execute(
            con_tenant(select(func.count(Curso.id)).where(Curso.estado == "activo"), Curso)
        )
        total_cursos_activos = cursos_activos.scalar()

        # Total participantes
        participantes_total = await db.execute(con_tenant(select(func.count(Participante.id)), Participante))
        total_participantes = participantes_total.scalar()

        # Certificados emitidos (vía curso -> cliente_id)
        cert_q = (
            select(func.count(CursoParticipante.id))
            .join(Curso, CursoParticipante.curso_id == Curso.id)
            .where(CursoParticipante.estado_acreditacion == True)
        )
        if not es_plataforma:
            cert_q = cert_q.where(Curso.cliente_id == cid)
        certificados_emitidos = await db.execute(cert_q)
        total_certificados = certificados_emitidos.scalar()

        return {
            "clientes": {
                "total": total_clientes,
                "activos": total_clientes_activos,
                "porcentaje_activos": (total_clientes_activos / total_clientes * 100) if total_clientes > 0 else 0
            },
            "cursos": {
                "total": total_cursos,
                "activos": total_cursos_activos,
                "porcentaje_activos": (total_cursos_activos / total_cursos * 100) if total_cursos > 0 else 0
            },
            "participantes": {
                "total": total_participantes
            },
            "certificados": {
                "emitidos": total_certificados
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")

@router.get("/mis-cursos")
async def get_mis_cursos(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        cursos = await db.execute(text("SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado, empresa_contratante FROM cursos WHERE cliente_id = :cid ORDER BY fecha_inicio DESC"), {"cid": cid})
        cursos_rows = cursos.fetchall()
        data = []
        for r in cursos_rows:
            curso_id = r[0]
            participantes = await db.execute(text(
                """
                SELECT
                  cp.id,
                  p.nombre AS nombres,
                  p.apellido AS ap_pat,
                  NULL::VARCHAR AS apellido_materno,
                  cp.estado_pago,
                  (
                    SELECT COALESCE(SUM(CASE WHEN p2.estado_pago IN ('completado','pagado') THEN p2.monto ELSE 0 END), 0)
                    FROM aaces.pagos p2 WHERE p2.curso_participante_id = cp.id
                  ) AS valor_pagado,
                  (
                    SELECT COALESCE(
                      cp.costo_asignado,
                      (
                        SELECT COALESCE(g.precio_base, g.precio_promocional)
                        FROM aaces.grupos_curso g
                        WHERE g.id = c.grupo_id
                        LIMIT 1
                      ),
                      (
                        SELECT COALESCE(tc.costo_por_persona, 0)
                        FROM aaces.tipos_curso tc
                        WHERE tc.cliente_id = c.cliente_id AND tc.nombre = c.nombre
                        LIMIT 1
                      ),
                      COALESCE(c.precio_base, c.precio_promocional),
                      COALESCE(c.costo_total, 0),
                      0
                    )
                    FROM aaces.cursos c
                    WHERE c.id = cp.curso_id
                  ) AS costo_asignado,
                  0 AS descuento
                FROM aaces.curso_participante cp
                JOIN aaces.participantes p ON p.id = cp.participante_id
                WHERE cp.curso_id = :cid
                ORDER BY p.nombre
                """
            ), {"cid": curso_id})
            parts_rows = participantes.fetchall()
            parts = [
                {"cp_id": rr[0], "nombres": rr[1], "apellido_paterno": rr[2], "apellido_materno": rr[3], "estado_pago": rr[4], "valor_pagado": float(rr[5] or 0), "costo_asignado": float(rr[6] or 0), "descuento": float(rr[7] or 0)}
                for rr in parts_rows
            ]
            data.append({
                "id": r[0], "codigo_curso": r[1], "nombre": r[2], "ciudad": r[3], "fecha_inicio": r[4], "fecha_fin": r[5], "estado": r[6], "empresa_contratante": r[7], "participantes": parts
            })
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo cursos: {str(e)}")

@router.get("/agenda/proximos")
async def get_proximos_cursos(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Lista de cursos próximos del cliente, ordenados por fecha de inicio"""
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        parents_q = text(
            """
            SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado, empresa_contratante,
                   precio_base, precio_promocional
            FROM cursos
            WHERE cliente_id = :cid AND curso_padre_id IS NULL
              AND (
                (fecha_inicio IS NOT NULL AND fecha_inicio >= CURRENT_DATE)
                OR (fecha_inicio IS NULL AND fecha_fin IS NOT NULL AND fecha_fin >= CURRENT_DATE)
                OR (fecha_inicio IS NULL AND fecha_fin IS NULL AND estado = 'en_espera')
              )
            ORDER BY fecha_inicio NULLS LAST, fecha_fin ASC
            """
        )
        parents = await db.execute(parents_q, {"cid": cid})
        parent_rows = parents.fetchall()
        data = []
        for r in parent_rows:
            pid = r[0]
            children = await db.execute(text("SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado, empresa_contratante, precio_base, precio_promocional FROM cursos WHERE curso_padre_id = :pid ORDER BY fecha_inicio NULLS LAST, fecha_fin ASC"), {"pid": pid})
            child_rows = children.fetchall()
            data.append({
                "id": r[0], "codigo_curso": r[1], "nombre": r[2], "ciudad": r[3],
                "fecha_inicio": r[4], "fecha_fin": r[5], "estado": r[6], "empresa_contratante": r[7],
                "precio_base": float(r[8] or 0), "precio_promocional": float(r[9] or 0) if r[9] is not None else None,
                "subcursos": [
                    {"id": c[0], "codigo_curso": c[1], "nombre": c[2], "ciudad": c[3], "fecha_inicio": c[4], "fecha_fin": c[5], "estado": c[6], "empresa_contratante": c[7], "precio_base": float(c[8] or 0), "precio_promocional": float(c[9] or 0) if c[9] is not None else None}
                for c in child_rows
                ]
            })
        return data
    except Exception as e:
        msg = str(e)
        if "column \"curso_padre_id\" does not exist" in msg:
            try:
                await db.rollback()
                await db.execute(text("SET LOCAL search_path TO aaces"))
                await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS curso_padre_id UUID"))
                await db.commit()
                return await get_proximos_cursos(identity, db)
            except Exception as e2:
                await db.rollback()
                raise HTTPException(status_code=500, detail=f"Error agregando columna curso_padre_id: {str(e2)}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo próximos cursos: {msg}")

@router.get("/agenda/mes")
async def get_agenda_mes(
    year: int,
    month: int,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Cursos del cliente que intersectan con el mes solicitado, incluyendo subcursos"""
    try:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Mes inválido")
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        # Rango de mes [start, end] en tipos date nativos
        from datetime import date, timedelta
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year, 12, 31)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)

        # Intersección de rangos: (fi <= end) AND (ff >= start)
        parents_q = text(
            """
            SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado, empresa_contratante,
                   precio_base, precio_promocional
            FROM cursos
            WHERE cliente_id = :cid AND curso_padre_id IS NULL
              AND (
                (fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL AND fecha_inicio <= CAST(:end AS date) AND fecha_fin >= CAST(:start AS date))
                OR (fecha_inicio IS NOT NULL AND fecha_fin IS NULL AND fecha_inicio BETWEEN CAST(:start AS date) AND CAST(:end AS date))
                OR (fecha_inicio IS NULL AND fecha_fin IS NOT NULL AND fecha_fin BETWEEN CAST(:start AS date) AND CAST(:end AS date))
                OR (fecha_inicio IS NULL AND fecha_fin IS NULL AND estado = 'en_espera')
              )
            ORDER BY fecha_inicio NULLS LAST, fecha_fin ASC
            """
        )
        parents = await db.execute(parents_q, {"cid": cid, "start": start_date, "end": end_date})
        parent_rows = parents.fetchall()
        data = []
        for r in parent_rows:
            pid = r[0]
            children_q = text(
                """
                SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado, empresa_contratante,
                       precio_base, precio_promocional
                FROM cursos
                WHERE curso_padre_id = :pid
                  AND (
                    (fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL AND fecha_inicio <= CAST(:end AS date) AND fecha_fin >= CAST(:start AS date))
                    OR (fecha_inicio IS NOT NULL AND fecha_fin IS NULL AND fecha_inicio BETWEEN CAST(:start AS date) AND CAST(:end AS date))
                    OR (fecha_inicio IS NULL AND fecha_fin IS NOT NULL AND fecha_fin BETWEEN CAST(:start AS date) AND CAST(:end AS date))
                    OR (fecha_inicio IS NULL AND fecha_fin IS NULL AND estado = 'en_espera')
                  )
                ORDER BY fecha_inicio NULLS LAST, fecha_fin ASC
                """
            )
            children = await db.execute(children_q, {"pid": pid, "start": start_date, "end": end_date})
            child_rows = children.fetchall()
            data.append({
                "id": r[0], "codigo_curso": r[1], "nombre": r[2], "ciudad": r[3],
                "fecha_inicio": r[4], "fecha_fin": r[5], "estado": r[6], "empresa_contratante": r[7],
                "precio_base": float(r[8] or 0), "precio_promocional": float(r[9] or 0) if r[9] is not None else None,
                "subcursos": [
                    {"id": c[0], "codigo_curso": c[1], "nombre": c[2], "ciudad": c[3], "fecha_inicio": c[4], "fecha_fin": c[5], "estado": c[6], "empresa_contratante": c[7], "precio_base": float(c[8] or 0), "precio_promocional": float(c[9] or 0) if c[9] is not None else None}
                for c in child_rows
                ]
            })
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo cursos del mes: {str(e)}")

@router.post("/cursos")
async def crear_curso(
    payload: CursoCreatePayload,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Crear un nuevo curso para el cliente autenticado"""
    try:
        cid = await get_current_cliente_id(db, identity)
        data = payload.dict(exclude_unset=True)
        nombre = (data.get("nombre") or "").strip()
        ciudad = (data.get("ciudad") or "").strip()
        empresa = (data.get("empresa_contratante") or "").strip() or None
        fi_raw = payload.fecha_inicio
        ff_raw = payload.fecha_fin
        precio_base = None
        precio_promocional = None
        try:
            if payload.precio_base is not None:
                precio_base = float(payload.precio_base)
                if precio_base < 0:
                    precio_base = 0.0
        except Exception:
            precio_base = None
        try:
            if payload.precio_promocional is not None:
                precio_promocional = float(payload.precio_promocional)
                if precio_promocional is not None and precio_promocional < 0:
                    precio_promocional = 0.0
        except Exception:
            precio_promocional = None

        if not (nombre and ciudad):
            raise HTTPException(status_code=400, detail="Nombre y ciudad son requeridos")

        # Trial check: límite de cursos según plan/suscripción
        org_id = identity.org_id
        if org_id:
            # New schema: check subscription limits
            sub_res = await db.execute(
                text("""
                    SELECT s.cursos_max, p.codigo
                    FROM aaces.suscripciones s
                    JOIN aaces.planes p ON p.id = s.plan_id
                    WHERE s.organizacion_id = :org_id AND s.estatus = 'activa'
                    LIMIT 1
                """),
                {"org_id": org_id}
            )
            sub_row = sub_res.fetchone()
            if sub_row:
                cursos_max = int(sub_row[0] or 10)
                plan_name = sub_row[1]
                if plan_name == 'trial':
                    cursos_count_res = await db.execute(
                        text("SELECT count(*) FROM aaces.cursos WHERE cliente_id IN (SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id) AND estado IN ('activo', 'en_espera', 'finalizado')"),
                        {"org_id": org_id}
                    )
                    cursos_actuales = int(cursos_count_res.scalar() or 0)
                    if cursos_actuales >= cursos_max:
                        raise HTTPException(
                            status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail=f"Has alcanzado el límite de {cursos_max} cursos del plan trial. Actualiza tu plan para crear más cursos."
                        )
        else:
            # Old schema: check clientes table
            plan_res = await db.execute(
                text("SELECT plan, cursos_max FROM clientes WHERE id = :cid"),
                {"cid": cid}
            )
            plan_row = plan_res.fetchone()
            if plan_row:
                plan_name = plan_row[0]
                cursos_max = int(plan_row[1] or 10)
                if plan_name == 'trial':
                    cursos_count_res = await db.execute(
                        text("SELECT count(*) FROM cursos WHERE cliente_id = :cid AND estado IN ('activo', 'en_espera', 'finalizado')"),
                        {"cid": cid}
                    )
                    cursos_actuales = int(cursos_count_res.scalar() or 0)
                    if cursos_actuales >= cursos_max:
                        raise HTTPException(
                            status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail=f"Has alcanzado el límite de {cursos_max} cursos del plan trial. Actualiza tu plan para crear más cursos."
                        )

        # Parseo de fechas flexible
        def parse_date(val):
            if not val:
                return None
            if isinstance(val, date):
                return val
            s = str(val).strip()
            if 'T' in s:
                s = s.split('T')[0]
            try:
                return datetime.fromisoformat(s).date()
            except Exception:
                pass
            for sep in ('/', '-', '.', ' '):
                parts = s.split(sep)
                if len(parts) == 3:
                    try:
                        if len(parts[0]) == 4:
                            y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                        else:
                            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                        return date(y, m, d)
                    except Exception:
                        continue
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

        fi_dt = fi_raw if isinstance(fi_raw, date) else parse_date(fi_raw)
        ff_dt = ff_raw if isinstance(ff_raw, date) else parse_date(ff_raw)
        estado_ins = "en_espera"
        if fi_dt or ff_dt:
            if fi_dt and ff_dt and fi_dt > ff_dt:
                raise HTTPException(status_code=400, detail="fecha_inicio no puede ser mayor que fecha_fin")
            if fi_dt and not ff_dt:
                ff_dt = fi_dt
            estado_ins = "activo"
        # Generar código
        code_base = datetime.utcnow().strftime("%Y%m%d")
        suffix = uuid.uuid4().hex[:6].upper()
        # Asegurar columnas de precio
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10,2) DEFAULT 0"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2)"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS vigencia_meses INTEGER"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ALTER COLUMN vigencia_meses DROP DEFAULT"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS catalogo_curso_id UUID"))

        q = text(
            """
            INSERT INTO cursos (id, cliente_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, estado, empresa_contratante, grupo_id, precio_base, precio_promocional, vigencia_meses, catalogo_curso_id, creado_por, fecha_creacion)
            VALUES (gen_random_uuid(), :cid, :code, :nombre, :ciudad, :fi, :ff, :duracion, :modalidad, :estado, :empresa, :grupo_id, :precio_base, :precio_promocional, :vigencia_meses, :catalogo_curso_id, :cid, now())
            RETURNING id
            """
        )
        try:
            duracion = int(data.get("duracion_horas", 8) or 8)
        except Exception:
            duracion = 8
        grupo_id = (data.get("grupo_id") or None)
        # vigencia opcional, sin default
        vig_raw = data.get("vigencia_meses")
        vigm = None
        if vig_raw is not None:
            try:
                _v = int(vig_raw)
                if _v > 0:
                    vigm = _v
            except Exception:
                vigm = None
        modalidad_in = str(data.get("modalidad") or "presencial").strip().lower()
        modalidad_val = modalidad_in if modalidad_in in ("presencial", "virtual", "mixta") else "presencial"
        # Vínculo opcional al catálogo: el curso del catálogo debe ser de la
        # propia organización (el FK solo valida existencia, no propiedad).
        catalogo_curso_id = data.get("catalogo_curso_id") or None
        if catalogo_curso_id and org_id:
            own = await db.execute(
                text("SELECT 1 FROM aaces.catalogo_cursos WHERE id = :cid AND organizacion_id = :org_id AND activo = true LIMIT 1"),
                {"cid": catalogo_curso_id, "org_id": org_id},
            )
            if not own.fetchone():
                raise HTTPException(status_code=400, detail="Curso del catálogo inválido")
        res = await db.execute(q, {"cid": cid, "code": f"CUR-{code_base}-{suffix}", "nombre": nombre, "ciudad": ciudad, "fi": fi_dt, "ff": ff_dt, "empresa": empresa, "duracion": duracion, "estado": estado_ins, "grupo_id": grupo_id, "precio_base": precio_base, "precio_promocional": precio_promocional, "vigencia_meses": vigm, "modalidad": modalidad_val, "catalogo_curso_id": catalogo_curso_id})
        parent_id = res.scalar()

        # Subcursos
        subs = payload.subcursos or []
        for sc in subs:
            sn = (getattr(sc, "nombre", None) or "").strip()
            s_ciudad = (getattr(sc, "ciudad", None) or "").strip()
            s_fi_raw = getattr(sc, "fecha_inicio", None)
            s_ff_raw = getattr(sc, "fecha_fin", None)
            s_emp = (getattr(sc, "empresa_contratante", None) or "").strip() or None
            if not (sn and s_ciudad):
                continue
            try:
                s_fi_dt = parse_date(s_fi_raw)
                s_ff_dt = parse_date(s_ff_raw)
            except HTTPException:
                continue
            s_estado = "en_espera"
            if s_fi_dt or s_ff_dt:
                if s_fi_dt and s_ff_dt and s_fi_dt > s_ff_dt:
                    continue
                if s_fi_dt and not s_ff_dt:
                    s_ff_dt = s_fi_dt
                s_estado = "activo"
            s_suffix = uuid.uuid4().hex[:6].upper()
            try:
                s_dur = int(getattr(sc, "duracion_horas", 8) or 8)
            except Exception:
                s_dur = 8
            sub_res = await db.execute(
                text(
                    """
                    INSERT INTO cursos (id, cliente_id, curso_padre_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, estado, empresa_contratante, grupo_id, precio_base, precio_promocional, vigencia_meses, creado_por, fecha_creacion)
                    VALUES (gen_random_uuid(), :cid, :pid, :code, :nombre, :ciudad, :fi, :ff, :duracion, :modalidad, :estado, :empresa, :grupo_id, :precio_base, :precio_promocional, :vigencia_meses, :cid, now())
                    RETURNING id
                """
                ),
                {"cid": cid, "pid": parent_id, "code": f"CUR-{code_base}-{s_suffix}", "nombre": sn, "ciudad": s_ciudad, "fi": s_fi_dt, "ff": s_ff_dt, "empresa": s_emp, "grupo_id": grupo_id, "duracion": s_dur, "estado": s_estado, "precio_base": precio_base, "precio_promocional": precio_promocional, "vigencia_meses": vigm, "modalidad": modalidad_val}
            )
            sub_id = sub_res.scalar()
        # Constancias del curso (catálogo inicial)
        consts = payload.constancias or []
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS constancias_curso (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
              nombre VARCHAR(200) NOT NULL,
              norma VARCHAR(200),
              fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(curso_id, nombre)
            )
            """
        ))
        for cc in consts:
            n = (getattr(cc, "nombre", None) or "").strip()
            norma = (getattr(cc, "norma", None) or "").strip() or None
            if not n:
                continue
            await db.execute(text("INSERT INTO constancias_curso (curso_id, nombre, norma) VALUES (:curso, :n, :norma) ON CONFLICT (curso_id, nombre) DO UPDATE SET norma = EXCLUDED.norma"), {"curso": parent_id, "n": n, "norma": norma})
        await db.commit()
        return {"id": str(parent_id), "subcursos": len(subs), "constancias": len(consts)}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando curso: {str(e)}")

class CursoEditPayload(BaseModel):
    ciudad: Optional[str] = None
    empresa_contratante: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    grupo_id: Optional[str] = None
    precio_base: Optional[float] = None
    precio_promocional: Optional[float] = None
    estado: Optional[str] = None
    vigencia_meses: Optional[int] = None
    modalidad: Optional[str] = None

@router.put("/cursos/{curso_id}")
async def update_curso(
    curso_id: str,
    payload: CursoEditPayload,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        def ensure_date(value):
            if value is None:
                return None
            if isinstance(value, date):
                return value
            return date.fromisoformat(str(value))
        print("DEBUG tipos:", type(payload.fecha_inicio), type(payload.fecha_fin))
        print("DEBUG valores:", payload.fecha_inicio, payload.fecha_fin)
        sets = []
        params = {"curso_id": curso_id, "cid": cid}
        if payload.ciudad is not None:
            sets.append("ciudad = :ciudad")
            params["ciudad"] = payload.ciudad
        if payload.empresa_contratante is not None:
            sets.append("empresa_contratante = :empresa_contratante")
            params["empresa_contratante"] = payload.empresa_contratante
        if payload.grupo_id is not None:
            sets.append("grupo_id = :grupo_id")
            params["grupo_id"] = payload.grupo_id or None
        if payload.precio_base is not None:
            sets.append("precio_base = :precio_base")
            try:
                params["precio_base"] = max(0.0, float(payload.precio_base))
            except Exception:
                params["precio_base"] = None
        if payload.precio_promocional is not None:
            sets.append("precio_promocional = :precio_promocional")
            try:
                val = float(payload.precio_promocional)
                params["precio_promocional"] = max(0.0, val)
            except Exception:
                params["precio_promocional"] = None
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS vigencia_meses INTEGER DEFAULT 24"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ALTER COLUMN vigencia_meses DROP DEFAULT"))
        if payload.vigencia_meses is not None:
            try:
                vm = int(payload.vigencia_meses)
                if vm <= 0:
                    vm = 24
            except Exception:
                vm = 24
            sets.append("vigencia_meses = :vigencia_meses")
            params["vigencia_meses"] = vm
        if payload.modalidad is not None:
            mod = str(payload.modalidad).strip().lower()
            if mod not in ("presencial", "virtual"):
                mod = "presencial"
            sets.append("modalidad = :modalidad")
            params["modalidad"] = mod
        if payload.fecha_inicio is not None:
            sets.append("fecha_inicio = :fecha_inicio")
            params["fecha_inicio"] = ensure_date(payload.fecha_inicio)
        if payload.fecha_fin is not None:
            sets.append("fecha_fin = :fecha_fin")
            params["fecha_fin"] = ensure_date(payload.fecha_fin)
        if payload.estado is not None:
            st = str(payload.estado or "").strip().lower()
            if st not in ("activo", "en_espera", "cancelado"):
                raise HTTPException(status_code=400, detail="Estado inválido (permitidos: activo, en_espera, cancelado)")
            sets.append("estado = :estado")
            params["estado"] = st
        elif (payload.fecha_inicio is not None) or (payload.fecha_fin is not None):
            sets.append("estado = :estado")
            params["estado"] = "activo"
        if not sets:
            return {"updated": 0}
        q = text(f"UPDATE cursos SET {', '.join(sets)} WHERE id = :curso_id AND cliente_id = :cid")
        await db.execute(q, params)
        if ("fecha_fin = :fecha_fin" in sets) or ("vigencia_meses = :vigencia_meses" in sets):
            row = await db.execute(text("SELECT fecha_fin, vigencia_meses FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
            r = row.fetchone()
            if r:
                fin = r[0]
                vig = r[1]
                if fin is not None:
                    await db.execute(text("UPDATE curso_participante SET fecha_emision_certificado = CAST(:fin_ts AS TIMESTAMP WITH TIME ZONE), fecha_expiracion = CASE WHEN COALESCE(CAST(:vig_int AS integer), 0) > 0 THEN (CAST(:fin_date AS date) + make_interval(months => CAST(:vig_int AS integer)))::date ELSE NULL END WHERE curso_id = :cid2"), {"fin_ts": fin, "fin_date": fin, "vig_int": vig, "cid2": curso_id})
                    await db.execute(text("UPDATE aaces.curso_participante SET fecha_emision_certificado = CAST(:fin_ts AS TIMESTAMP WITH TIME ZONE), fecha_expiracion = CASE WHEN COALESCE(CAST(:vig_int AS integer), 0) > 0 THEN (CAST(:fin_date AS date) + make_interval(months => CAST(:vig_int AS integer)))::date ELSE NULL END WHERE curso_id = :cid2"), {"fin_ts": fin, "fin_date": fin, "vig_int": vig, "cid2": curso_id})
        await db.commit()
        return {"updated": 1}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error actualizando curso: {str(e)}")

@router.post("/cursos/{curso_id}/aplicar-precio-grupo")
async def aplicar_precio_grupo(
    curso_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        modo = str(payload.get("mode") or payload.get("aplicar_a") or "solo_vacios").strip()
        await db.execute(text("SET LOCAL search_path TO aaces"))
        row = await db.execute(text("SELECT grupo_id FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        gid = row.scalar()
        if gid is None:
            raise HTTPException(status_code=400, detail="El curso no tiene grupo asignado")
        prow = await db.execute(text("SELECT COALESCE(precio_promocional, precio_base) FROM grupos_curso WHERE id = :gid"), {"gid": gid})
        precio = float(prow.scalar() or 0)
        updated_local = 0
        if modo == "todos":
            res2 = await db.execute(text("UPDATE aaces.curso_participante SET costo_asignado = :px WHERE curso_id = :cid"), {"px": precio, "cid": curso_id})
        else:
            res2 = await db.execute(text("UPDATE aaces.curso_participante SET costo_asignado = :px WHERE curso_id = :cid AND (costo_asignado IS NULL OR costo_asignado = 0)"), {"px": precio, "cid": curso_id})
        updated_aaces = res2.rowcount or 0
        await db.commit()
        return {"updated_local": int(updated_local), "updated_aaces": int(updated_aaces), "precio": precio}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error aplicando precio de grupo: {str(e)}")

@router.put("/curso-participante/{cp_id}/precio")
async def update_precio_participante(
    cp_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Gate de propiedad ANTES de modificar.
        await _exigir_cp_propio(db, identity, cp_id)
        q_a = text("UPDATE aaces.curso_participante SET costo_asignado = :costo, descuento = :descuento WHERE id = :id")
        await db.execute(q_a, {"costo": payload.get("costo_asignado", 0), "descuento": payload.get("descuento", 0), "id": cp_id})
        await db.commit()
        return {"updated": 1}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error actualizando precio: {str(e)}")

@router.get("/curso-participante/{cp_id}/pagos")
async def get_pagos_participante(
    cp_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        await _exigir_cp_propio(db, identity, cp_id)
        res = await db.execute(text("SELECT id, monto, metodo_pago, fecha_pago, estado_pago, comprobante_url FROM aaces.pagos WHERE curso_participante_id = :id ORDER BY fecha_pago DESC"), {"id": cp_id})
        rows = res.fetchall()
        return [{"id": r[0], "monto": float(r[1] or 0), "metodo_pago": r[2], "fecha_pago": r[3], "estado_pago": r[4], "comprobante_url": r[5]} for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo pagos: {str(e)}")

@router.post("/curso-participante/{cp_id}/pagos")
async def add_pago_participante(
    cp_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await _exigir_cp_propio(db, identity, cp_id)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10,2) DEFAULT 0"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2)"))
        q = text("INSERT INTO aaces.pagos (cliente_id, curso_participante_id, tipo_pago, monto, moneda, metodo_pago, referencia_pago, comprobante_url, fecha_pago, estado_pago, notas, creado_por) VALUES (:cid, :cp, 'participante', :monto, 'MXN', :metodo, :ref, :comp, COALESCE(:fecha, now()), :estado, :notas, :cid) RETURNING id")
        monto = float(payload.get("monto", 0) or 0)
        cid_res = await db.execute(text("SELECT curso_id FROM aaces.curso_participante WHERE id = :id"), {"id": cp_id})
        c_row = cid_res.fetchone()
        ins_res = await db.execute(q, {"cid": cid, "cp": cp_id, "monto": monto, "metodo": payload.get("metodo_pago", "efectivo"), "ref": payload.get("referencia_pago"), "comp": payload.get("comprobante_url"), "fecha": payload.get("fecha_pago"), "estado": payload.get("estado_pago", "completado"), "notas": payload.get("notas")})
        pay_id = ins_res.scalar()
        # Recalcular totales y estado del participante
        sums = await db.execute(text("SELECT COALESCE(SUM(monto),0) FROM aaces.pagos WHERE curso_participante_id = :cp AND estado_pago IN ('completado','pagado')"), {"cp": cp_id})
        total_pagado = float(sums.scalar() or 0)
        costo_row = await db.execute(text(
            """
            SELECT COALESCE(
              cp.costo_asignado,
              (
                SELECT COALESCE(g.precio_base, g.precio_promocional)
                FROM aaces.grupos_curso g WHERE g.id = c.grupo_id
                LIMIT 1
              ),
              (
                SELECT COALESCE(tc.costo_por_persona, 0)
                FROM aaces.tipos_curso tc
                WHERE tc.cliente_id = c.cliente_id AND tc.nombre = c.nombre
                LIMIT 1
              ),
              COALESCE(c.precio_base, c.precio_promocional),
              COALESCE(c.costo_total, 0),
              0
            )
            FROM aaces.cursos c
            JOIN aaces.curso_participante cp ON cp.curso_id = c.id
            WHERE cp.id = :cp
            """
        ), {"cp": cp_id})
        curso_costo = float(costo_row.scalar() or 0)
        nuevo_estado = 'pendiente'
        if total_pagado >= curso_costo and curso_costo > 0:
            nuevo_estado = 'pagado'
        elif total_pagado > 0:
            nuevo_estado = 'anticipo'
        await db.execute(text("UPDATE curso_participante SET estado_pago = :estado, valor_pagado = :pagado WHERE id = :cp"), {"estado": nuevo_estado, "pagado": total_pagado, "cp": cp_id})
        await db.execute(text("UPDATE aaces.curso_participante SET estado_pago = :estado, valor_pagado = :pagado WHERE id = :cp"), {"estado": nuevo_estado, "pagado": total_pagado, "cp": cp_id})
        await db.commit()
        return {"created": 1, "estado_pago": nuevo_estado, "valor_pagado": total_pagado, "costo_asignado": curso_costo}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando pago: {str(e)}")

@router.get("/cursos/{curso_id}/participantes")
async def list_participantes_curso(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10,2) DEFAULT 0"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2)"))
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        # Asegurar ON DELETE CASCADE en la FK de pagos -> curso_participante (solo aaces)
        try:
            await db.execute(text("ALTER TABLE IF EXISTS aaces.pagos DROP CONSTRAINT IF EXISTS curso_participante_id_fkey"))
            await db.execute(text("ALTER TABLE IF EXISTS aaces.pagos DROP CONSTRAINT IF EXISTS pagos_curso_participante_id_fkey"))
            await db.execute(text("ALTER TABLE IF EXISTS aaces.pagos ADD CONSTRAINT pagos_curso_participante_id_fkey FOREIGN KEY (curso_participante_id) REFERENCES aaces.curso_participante(id) ON DELETE CASCADE"))
        except Exception:
            pass
        q = text(
            """
            SELECT
              cp.id,
              p.id,
              p.nombre,
              p.apellido,
              p.nombre AS nombres,
              p.apellido_paterno,
              p.apellido_materno,
              p.correo,
              p.ciudad_origen,
              p.telefono,
              p.empresa,
              p.cargo,
              p.nivel_educacion,
              cp.estado_pago,
              cp.id_certificado,
              cp.codigo_validacion,
              cp.estado_acreditacion,
              cp.fecha_emision_certificado,
              cp.fecha_inicio_vigencia,
              cp.fecha_expiracion,
              (
                SELECT COALESCE(SUM(CASE WHEN p2.estado_pago IN ('completado','pagado') THEN p2.monto ELSE 0 END), 0)
                FROM aaces.pagos p2 WHERE p2.curso_participante_id = cp.id
              ) AS valor_pagado,
              (
                SELECT COALESCE(
                  cp.costo_asignado,
                  (
                    SELECT COALESCE(g.precio_base, g.precio_promocional)
                    FROM aaces.grupos_curso g
                    WHERE g.id = c.grupo_id
                    LIMIT 1
                  ),
                  (
                    SELECT COALESCE(tc.costo_por_persona, 0)
                    FROM aaces.tipos_curso tc
                    WHERE tc.cliente_id = c.cliente_id AND tc.nombre = c.nombre
                    LIMIT 1
                  ),
                  COALESCE(c.costo_total, 0),
                  0
                )
                FROM aaces.cursos c
                WHERE c.id = cp.curso_id
              ) AS costo_asignado,
              0 AS descuento,
              p.curp,
              p.ocupacion
            FROM aaces.curso_participante cp
            JOIN aaces.participantes p ON p.id = cp.participante_id
            WHERE cp.curso_id = :cid
            GROUP BY cp.id, p.id, p.nombre, p.apellido, p.correo, p.ciudad_origen, p.telefono, p.empresa, p.cargo, p.nivel_educacion, cp.estado_pago, cp.id_certificado, cp.codigo_validacion, cp.estado_acreditacion, cp.fecha_emision_certificado, cp.fecha_inicio_vigencia, cp.fecha_expiracion
            ORDER BY p.nombre
            """
        )
        rows = (await db.execute(q, {"cid": curso_id})).fetchall()
        return [
            {
                "id": r[0],
                "participante_id": r[1],
                "nombre": r[2],
                "apellido": r[3],
                "nombres": r[4],
                "apellido_paterno": r[5],
                "apellido_materno": r[6],
                "correo": r[7],
                "ciudad_origen": r[8],
                "telefono": r[9],
                "empresa": r[10],
                "cargo": r[11],
                "profesion": r[12],
                "estado_pago": r[13],
                "id_certificado": r[14],
                "codigo_validacion": r[15],
                "estado_acreditacion": bool(r[16]) if r[16] is not None else None,
                "fecha_emision_certificado": r[17],
                "fecha_inicio_vigencia": r[18],
                "fecha_expiracion": r[19],
                "valor_pagado": float(r[20] or 0),
                "costo_asignado": float(r[21] or 0),
                "descuento": float(r[22] or 0),
                "curp": descifrar(r[23]),
                "ocupacion": r[24],
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listando participantes: {str(e)}")

@router.get("/cursos/{curso_id}/participantes/export")
async def export_participantes_curso(
    curso_id: str,
    format: Optional[str] = Query("csv"),
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        q = text(
            """
            SELECT
              cp.id,
              p.id,
              p.nombre,
              p.apellido,
              p.nombre AS nombres,
              p.apellido_paterno,
              p.apellido_materno,
              p.correo,
              p.ciudad_origen,
              p.telefono,
              p.empresa,
              p.cargo,
              p.nivel_educacion,
              cp.estado_pago,
              cp.id_certificado,
              cp.codigo_validacion,
              cp.estado_acreditacion,
              cp.fecha_emision_certificado,
              cp.fecha_expiracion,
              (
                SELECT COALESCE(SUM(CASE WHEN p2.estado_pago IN ('completado','pagado') THEN p2.monto ELSE 0 END), 0)
                FROM aaces.pagos p2 WHERE p2.curso_participante_id = cp.id
              ) AS valor_pagado,
              (
                SELECT COALESCE(
                  cp.costo_asignado,
                  (
                    SELECT COALESCE(g.precio_base, g.precio_promocional)
                    FROM aaces.grupos_curso g
                    WHERE g.id = c.grupo_id
                    LIMIT 1
                  ),
                  (
                    SELECT COALESCE(tc.costo_por_persona, 0)
                    FROM aaces.tipos_curso tc
                    WHERE tc.cliente_id = c.cliente_id AND tc.nombre = c.nombre
                    LIMIT 1
                  ),
                  COALESCE(c.costo_total, 0),
                  0
                )
                FROM aaces.cursos c
                WHERE c.id = cp.curso_id
              ) AS costo_asignado,
              0 AS descuento,
              p.curp,
              p.ocupacion
            FROM aaces.curso_participante cp
            JOIN aaces.participantes p ON p.id = cp.participante_id
            WHERE cp.curso_id = :cid
            GROUP BY cp.id, p.id, p.nombre, p.apellido, p.correo, p.ciudad_origen, p.telefono, p.empresa, p.cargo, p.nivel_educacion, cp.estado_pago, cp.id_certificado, cp.codigo_validacion, cp.estado_acreditacion, cp.fecha_emision_certificado, cp.fecha_expiracion
            ORDER BY p.nombre
            """
        )
        rows = (await db.execute(q, {"cid": curso_id})).fetchall()
        buf = io.StringIO()
        buf.write("\ufeff")  # BOM UTF-8-SIG para que Excel lea acentos correctamente
        writer = csv.writer(buf)
        writer.writerow(["Participante", "Correo", "Ciudad", "Teléfono", "Empresa", "Cargo", "Estado Pago", "ID Certificado", "Código Validación", "Emisión", "Expira", "Costo", "Descuento", "Pagado", "Saldo"])
        for r in rows:
            nombres = str(r[4] or r[2] or "")
            ap_pat = str(r[5] or r[3] or "")
            ap_mat = str(r[6] or "")
            nombre_completo = (" ".join([nombres, ap_pat, ap_mat])).strip()
            correo = r[7] or ""
            ciudad = r[8] or ""
            telefono = r[9] or ""
            empresa = r[10] or ""
            cargo = r[11] or ""
            estado_pago = r[13] or ""
            id_cert = r[14] or ""
            codigo_val = r[15] or ""
            emision = r[17] or ""
            expira = r[18] or ""
            valor_pagado = float(r[19] or 0)
            costo_asignado = float(r[20] or 0)
            descuento = float(r[21] or 0)
            saldo = (costo_asignado - descuento) - valor_pagado
            writer.writerow([nombre_completo, correo, ciudad, telefono, empresa, cargo, estado_pago, id_cert, codigo_val, str(emision)[:10] if emision else "", str(expira)[:10] if expira else "", f"{costo_asignado:.2f}", f"{descuento:.2f}", f"{valor_pagado:.2f}", f"{saldo:.2f}"])
        filename = f"participantes_{curso_id}.csv"
        headers = {"Content-Disposition": f"attachment; filename={filename}"}
        return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exportando participantes: {str(e)}")

@router.post("/cursos/{curso_id}/participantes")
async def add_participante_curso(
    curso_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        nombre = (payload.get("nombre") or "").strip()
        apellido = (payload.get("apellido") or "").strip()
        nombres = (payload.get("nombres") or nombre).strip()
        apellido_paterno = (payload.get("apellido_paterno") or apellido).strip()
        apellido_materno = (payload.get("apellido_materno") or "").strip()
        correo = (payload.get("correo") or "").strip()
        numero = ""
        tipo_documento = ""
        ciudad = (payload.get("ciudad_origen") or "").strip()
        telefono = (payload.get("telefono") or "").strip()
        empresa = (payload.get("empresa") or "").strip()
        cargo = (payload.get("cargo") or "").strip()
        profesion = (payload.get("profesion") or "").strip()
        if not ((nombres or nombre) and correo):
            raise HTTPException(status_code=400, detail="nombre y correo requeridos")
        # Sin validación de documento; campos eliminados del esquema
        # Buscar primero por numero_documento (único), luego por correo
        pid = None
        # Campo número_documento eliminado: no se usa para deduplicación
        if not pid and correo:
            # Deduplicación por tenant: el mismo correo puede existir en otra organización.
            ex_mail = await db.execute(text("SELECT id FROM aaces.participantes WHERE correo = :correo AND cliente_id = :cid"), {"correo": correo, "cid": cid})
            row_mail = ex_mail.fetchone()
            if row_mail:
                pid = row_mail[0]
        if pid:
            # Actualizar datos opcionales si se proporcionan
            sets = []
            params = {"pid": pid}
            if telefono:
                sets.append("telefono = :telefono"); params["telefono"] = telefono
            if empresa:
                sets.append("empresa = :empresa"); params["empresa"] = empresa
            if cargo:
                sets.append("cargo = :cargo"); params["cargo"] = cargo
            if profesion:
                sets.append("nivel_educacion = :profesion"); params["profesion"] = profesion
            if ciudad:
                sets.append("ciudad_origen = :ciudad"); params["ciudad"] = ciudad
            if correo:
                sets.append("correo = :correo_upd"); params["correo_upd"] = correo
            if sets:
                await db.execute(text(f"UPDATE aaces.participantes SET {', '.join(sets)} WHERE id = :pid"), params)
        else:
            combined_apellido = apellido or (apellido_paterno + (" " + apellido_materno if apellido_materno else ""))
            await db.execute(text("ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS apellido_paterno VARCHAR(100)"))
            await db.execute(text("ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS apellido_materno VARCHAR(100)"))
            pax_id = f"PAX-{uuid.uuid4().hex[:8].upper()}"
            ins = await db.execute(text("INSERT INTO aaces.participantes (id, pax_id, cliente_id, nombre, apellido, apellido_paterno, apellido_materno, correo, ciudad_origen, telefono, empresa, cargo, nivel_educacion, pais) VALUES (gen_random_uuid(), :pax_id, :cid, :nombre, :apellido, :ap_pat, :ap_mat, :correo, :ciudad, :telefono, :empresa, :cargo, :profesion, 'Mexico') RETURNING id"), {"pax_id": pax_id, "cid": cid, "nombre": (nombre or nombres) or None, "apellido": combined_apellido or None, "ap_pat": (apellido_paterno or "").strip() or None, "ap_mat": (apellido_materno or "").strip() or None, "correo": correo, "ciudad": ciudad or None, "telefono": telefono or None, "empresa": empresa or None, "cargo": cargo or None, "profesion": profesion or None})
            pid = ins.scalar()
        # Datos para el DC-3 (opcionales)
        _curp_v = "".join(str(payload.get("curp") or "").split()).upper()
        if _curp_v and (len(_curp_v) != 18 or not _curp_v.isalnum()):
            raise HTTPException(status_code=400, detail="La CURP debe tener 18 caracteres (letras y números)")
        _ocup_v = (payload.get("ocupacion") or "").strip()[:150]
        if _curp_v or _ocup_v:
            _s, _p = [], {"pid": pid}
            if _curp_v:
                _s.append("curp = :curp"); _p["curp"] = cifrar(_curp_v)
                _s.append("curp_hash = :curp_hash"); _p["curp_hash"] = indice(_curp_v)
            if _ocup_v:
                _s.append("ocupacion = :ocupacion"); _p["ocupacion"] = _ocup_v
            await db.execute(text(f"UPDATE aaces.participantes SET {', '.join(_s)} WHERE id = :pid"), _p)
        # Evitar violación de UNIQUE: si ya existe la inscripción, reutilizar su id
        ex_global = await db.execute(text("SELECT id FROM aaces.curso_participante WHERE curso_id = :curso AND participante_id = :pid"), {"curso": curso_id, "pid": pid})
        global_id = ex_global.scalar()
        cp_id = global_id
        if not cp_id:
            lnk = await db.execute(text(
                """
                INSERT INTO aaces.curso_participante (
                  id, curso_id, participante_id,
                  estado_pago, estado_acreditacion, fecha_inicio_vigencia, fecha_expiracion,
                  valor_pagado, costo_asignado, descuento
                )
                VALUES (
                  gen_random_uuid(), :curso, :pid,
                  'pendiente', true,
                  (
                    SELECT COALESCE(c.fecha_fin, c.fecha_inicio, CURRENT_DATE)
                    FROM aaces.cursos c WHERE c.id = :curso
                  ),
                  (
                    SELECT CASE WHEN COALESCE(c.vigencia_meses, c.duracion_validacion) IS NULL OR COALESCE(c.vigencia_meses, c.duracion_validacion) <= 0
                                THEN NULL
                                ELSE (COALESCE(c.fecha_fin, c.fecha_inicio, CURRENT_DATE)::date + make_interval(months => CAST(COALESCE(c.vigencia_meses, c.duracion_validacion) AS integer)))::date
                           END
                    FROM aaces.cursos c WHERE c.id = :curso
                  ),
                  0,
                  (
                    SELECT COALESCE(
                      (
                        SELECT COALESCE(g.precio_base, g.precio_promocional)
                        FROM aaces.grupos_curso g WHERE g.id = c.grupo_id
                        LIMIT 1
                      ),
                      (
                        SELECT tc.costo_por_persona
                        FROM aaces.tipos_curso tc
                        WHERE tc.cliente_id = c.cliente_id AND tc.nombre = c.nombre
                        LIMIT 1
                      ),
                      COALESCE(c.costo_total, 0),
                      0
                    )
                    FROM aaces.cursos c WHERE c.id = :curso
                  ),
                  0
                )
                RETURNING id
                """
            ), {"curso": curso_id, "pid": pid})
            cp_id = lnk.scalar()
        id_cert = (payload.get("id_certificado") or "").strip() or None
        cod_val = (payload.get("codigo_validacion") or "").strip()
        cod_val = cod_val.upper() if cod_val else None
        # Inscribir NO da folio ni QR: se asignan al acreditar el grupo (botón
        # "Acreditar y generar folios"), para no gastar constancias de quien no
        # toma el curso. Solo se acredita aquí si lo piden explícitamente, p. ej.
        # al capturar a alguien que ya tomó el curso y trae su folio.
        acreditado = bool(payload.get("acreditado") or payload.get("estado_acreditacion") or cod_val or id_cert)
        if acreditado:
            if id_cert is None:
                id_cert = f"CERT-{uuid.uuid4().hex[:8].upper()}"
            if cod_val is None:
                cod_val = uuid.uuid4().hex[:8].upper()
        emision_raw = payload.get("fecha_emision_certificado") or None
        expiracion_raw = payload.get("fecha_expiracion_certificado") or payload.get("fecha_expiracion") or None

        def _parse_date(v):
            if v is None or v == "":
                return None
            if isinstance(v, (date, datetime)):
                return v
            s = str(v).strip()
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                try:
                    return datetime.strptime(s, fmt).date()
                except ValueError:
                    continue
            try:
                return date.fromisoformat(s[:10])
            except ValueError:
                return None

        emision = _parse_date(emision_raw)
        expiracion = _parse_date(expiracion_raw)
        sets = []
        params = {"cp": cp_id, "curso": curso_id}
        if id_cert is not None:
            sets.append("id_certificado = :id_certificado"); params["id_certificado"] = id_cert
        if cod_val is not None:
            sets.append("codigo_validacion = :codigo_validacion"); params["codigo_validacion"] = cod_val
        sets.append("estado_acreditacion = :estado_acreditacion"); params["estado_acreditacion"] = acreditado
        if emision is not None:
            sets.append("fecha_emision_certificado = :fecha_emision_certificado"); params["fecha_emision_certificado"] = emision
        if expiracion is not None:
            sets.append("fecha_expiracion = :fecha_expiracion"); params["fecha_expiracion"] = expiracion
        org_cupo = None
        if params.get("codigo_validacion"):
            # Al agregarlo recibe folio y QR: cuenta para el límite del plan
            org_cupo = await cupo_service.verificar_participantes(db, [cp_id])
        if sets:
            await db.execute(text(f"UPDATE aaces.curso_participante SET {', '.join(sets)} WHERE id = :cp AND curso_id = :curso"), params)
        await db.commit()
        cupo_service.avisar_en_segundo_plano(org_cupo)
        return {"id": str(cp_id), "participante_id": str(pid)}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error agregando participante: {str(e)}")

@router.get("/grupos-curso")
async def get_grupos_curso(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS grupos_curso (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
              nombre VARCHAR(200) NOT NULL,
              descripcion TEXT,
              precio_base NUMERIC(10,2) DEFAULT 0,
              precio_promocional NUMERIC(10,2),
              estado VARCHAR(20) DEFAULT 'activo',
              fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """
        ))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS grupo_curso_items (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              grupo_id UUID NOT NULL REFERENCES grupos_curso(id) ON DELETE CASCADE,
              tipo_curso_id UUID NOT NULL REFERENCES tipos_curso(id) ON DELETE CASCADE,
              UNIQUE(grupo_id, tipo_curso_id)
            )
            """
        ))
        res = await db.execute(text("SELECT id, nombre, descripcion, precio_base, precio_promocional, estado FROM grupos_curso WHERE cliente_id = :cid ORDER BY nombre"), {"cid": cid})
        rows = res.fetchall()
        data = []
        for r in rows:
            gid = r[0]
            it = await db.execute(text("SELECT i.tipo_curso_id, t.nombre FROM grupo_curso_items i JOIN tipos_curso t ON t.id = i.tipo_curso_id WHERE i.grupo_id = :gid ORDER BY t.nombre"), {"gid": gid})
            items = [{"id": ir[0], "nombre": ir[1]} for ir in it.fetchall()]
            data.append({"id": r[0], "nombre": r[1], "descripcion": r[2], "precio_base": float(r[3] or 0), "precio_promocional": float(r[4] or 0) if r[4] is not None else None, "estado": r[5], "items": items})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo grupos: {str(e)}")

@router.post("/grupos-curso")
async def create_grupo_curso(
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("CREATE TABLE IF NOT EXISTS grupos_curso (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE, nombre VARCHAR(200) NOT NULL, descripcion TEXT, precio_base NUMERIC(10,2) DEFAULT 0, precio_promocional NUMERIC(10,2), estado VARCHAR(20) DEFAULT 'activo', fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)"))
        await db.execute(text("CREATE TABLE IF NOT EXISTS grupo_curso_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), grupo_id UUID NOT NULL REFERENCES grupos_curso(id) ON DELETE CASCADE, tipo_curso_id UUID NOT NULL REFERENCES tipos_curso(id) ON DELETE CASCADE, UNIQUE(grupo_id, tipo_curso_id))"))
        nombre = (payload.get("nombre") or "").strip()
        descripcion = (payload.get("descripcion") or None)
        precio_base = float(payload.get("precio_base") or 0)
        precio_promocional = payload.get("precio_promocional")
        if precio_promocional is not None:
            try:
                precio_promocional = float(precio_promocional)
            except Exception:
                precio_promocional = None
        items = payload.get("items") or []
        if not nombre:
            raise HTTPException(status_code=400, detail="nombre requerido")
        ins = await db.execute(text("INSERT INTO grupos_curso (id, cliente_id, nombre, descripcion, precio_base, precio_promocional, estado) VALUES (gen_random_uuid(), :cid, :nombre, :descripcion, :precio_base, :precio_promocional, 'activo') RETURNING id"), {"cid": cid, "nombre": nombre, "descripcion": descripcion, "precio_base": precio_base, "precio_promocional": precio_promocional})
        gid = ins.scalar()
        for tid in items:
            # Los tipos deben pertenecer a la organización (no basta conocer el id).
            ok = await db.execute(text("SELECT 1 FROM tipos_curso WHERE id = :tid AND cliente_id = :cid"), {"tid": tid, "cid": cid})
            if ok.scalar() is None:
                raise HTTPException(status_code=404, detail="Tipo de curso no encontrado")
            await db.execute(text("INSERT INTO grupo_curso_items (grupo_id, tipo_curso_id) VALUES (:gid, :tid) ON CONFLICT (grupo_id, tipo_curso_id) DO NOTHING"), {"gid": gid, "tid": tid})
        await db.commit()
        it = await db.execute(text("SELECT i.tipo_curso_id, t.nombre FROM grupo_curso_items i JOIN tipos_curso t ON t.id = i.tipo_curso_id WHERE i.grupo_id = :gid ORDER BY t.nombre"), {"gid": gid})
        items_out = [{"id": ir[0], "nombre": ir[1]} for ir in it.fetchall()]
        return {"id": str(gid), "nombre": nombre, "descripcion": descripcion, "precio_base": precio_base, "precio_promocional": precio_promocional, "estado": "activo", "items": items_out}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando grupo: {str(e)}")

@router.put("/grupos-curso/{grupo_id}")
async def update_grupo_curso(
    grupo_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        own = await db.execute(text("SELECT 1 FROM grupos_curso WHERE id = :id AND cliente_id = :cid"), {"id": grupo_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Grupo no encontrado")
        sets = []
        params = {"id": grupo_id}
        if "nombre" in payload:
            sets.append("nombre = :nombre"); params["nombre"] = (payload.get("nombre") or "").strip()
        if "descripcion" in payload:
            sets.append("descripcion = :descripcion"); params["descripcion"] = payload.get("descripcion")
        if "precio_base" in payload:
            try:
                pb = float(payload.get("precio_base") or 0)
            except Exception:
                pb = 0
            sets.append("precio_base = :precio_base"); params["precio_base"] = pb
        if "precio_promocional" in payload:
            pp = payload.get("precio_promocional")
            try:
                pp = float(pp) if pp is not None else None
            except Exception:
                pp = None
            sets.append("precio_promocional = :precio_promocional"); params["precio_promocional"] = pp
        if "estado" in payload:
            sets.append("estado = :estado"); params["estado"] = (payload.get("estado") or "").strip() or "activo"
        if sets:
            await db.execute(text(f"UPDATE grupos_curso SET {', '.join(sets)} WHERE id = :id"), params)
        if "items" in payload and isinstance(payload.get("items"), list):
            await db.execute(text("DELETE FROM grupo_curso_items WHERE grupo_id = :id"), {"id": grupo_id})
            for tid in payload.get("items"):
                ok = await db.execute(text("SELECT 1 FROM tipos_curso WHERE id = :tid AND cliente_id = :cid"), {"tid": tid, "cid": cid})
                if ok.scalar() is None:
                    raise HTTPException(status_code=404, detail="Tipo de curso no encontrado")
                await db.execute(text("INSERT INTO grupo_curso_items (grupo_id, tipo_curso_id) VALUES (:gid, :tid) ON CONFLICT (grupo_id, tipo_curso_id) DO NOTHING"), {"gid": grupo_id, "tid": tid})
        await db.commit()
        it = await db.execute(text("SELECT i.tipo_curso_id, t.nombre FROM grupo_curso_items i JOIN tipos_curso t ON t.id = i.tipo_curso_id WHERE i.grupo_id = :gid ORDER BY t.nombre"), {"gid": grupo_id})
        items_out = [{"id": ir[0], "nombre": ir[1]} for ir in it.fetchall()]
        row = await db.execute(text("SELECT id, nombre, descripcion, precio_base, precio_promocional, estado FROM grupos_curso WHERE id = :id"), {"id": grupo_id})
        r = row.fetchone()
        return {"id": r[0], "nombre": r[1], "descripcion": r[2], "precio_base": float(r[3] or 0), "precio_promocional": float(r[4] or 0) if r[4] is not None else None, "estado": r[5], "items": items_out}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error actualizando grupo: {str(e)}")

@router.put("/cursos/{curso_id}/participantes/{cp_id}")
async def update_participante_curso(
    curso_id: str,
    cp_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        await db.execute(text("SET LOCAL search_path TO aaces"))
        pid_res = await db.execute(text("SELECT participante_id FROM aaces.curso_participante WHERE id = :cp AND curso_id = :curso"), {"cp": cp_id, "curso": curso_id})
        pid_row = pid_res.fetchone()
        if not pid_row:
            raise HTTPException(status_code=404, detail="Participante no encontrado")
        pid = pid_row[0]
        sets_p = []
        params_p = {"pid": pid}
        if "nombre" in payload:
            sets_p.append("nombre = :nombre"); params_p["nombre"] = (payload.get("nombre") or "").strip()
        elif (payload.get("nombres") or "").strip():
            # La agenda edita el nombre como "nombres"; antes se ignoraba y el cambio se perdía
            sets_p.append("nombre = :nombre"); params_p["nombre"] = payload["nombres"].strip()
        if "apellido" in payload:
            sets_p.append("apellido = :apellido"); params_p["apellido"] = (payload.get("apellido") or "").strip()
        if "apellido_paterno" in payload:
            sets_p.append("apellido_paterno = :apellido_paterno"); params_p["apellido_paterno"] = (payload.get("apellido_paterno") or "").strip()
        if "apellido_materno" in payload:
            sets_p.append("apellido_materno = :apellido_materno"); params_p["apellido_materno"] = (payload.get("apellido_materno") or "").strip()
        if "telefono" in payload:
            sets_p.append("telefono = :telefono"); params_p["telefono"] = (payload.get("telefono") or "").strip()
        if "empresa" in payload:
            sets_p.append("empresa = :empresa"); params_p["empresa"] = (payload.get("empresa") or "").strip()
        if "cargo" in payload:
            sets_p.append("cargo = :cargo"); params_p["cargo"] = (payload.get("cargo") or "").strip()
        if "ocupacion" in payload:
            sets_p.append("ocupacion = :ocupacion"); params_p["ocupacion"] = (payload.get("ocupacion") or "").strip()[:150] or None
        if "curp" in payload:
            _c = "".join(str(payload.get("curp") or "").split()).upper()
            if _c and (len(_c) != 18 or not _c.isalnum()):
                raise HTTPException(status_code=400, detail="La CURP debe tener 18 caracteres (letras y números)")
            sets_p.append("curp = :curp"); params_p["curp"] = cifrar(_c)
            sets_p.append("curp_hash = :curp_hash"); params_p["curp_hash"] = indice(_c)
        if "profesion" in payload:
            sets_p.append("nivel_educacion = :profesion"); params_p["profesion"] = (payload.get("profesion") or "").strip()
        # Mantener compatibilidad en campo combinado 'apellido'
        if ("apellido_paterno" in payload) or ("apellido_materno" in payload):
            ap_pat = (payload.get("apellido_paterno") or "").strip()
            ap_mat = (payload.get("apellido_materno") or "").strip()
            combined = ap_pat + (f" {ap_mat}" if ap_mat else "")
            sets_p.append("apellido = :apellido_comb"); params_p["apellido_comb"] = combined
        if "correo" in payload:
            sets_p.append("correo = :correo"); params_p["correo"] = (payload.get("correo") or "").strip()
        # Campos de documento eliminados del esquema
        if "ciudad_origen" in payload:
            sets_p.append("ciudad_origen = :ciudad_origen"); params_p["ciudad_origen"] = (payload.get("ciudad_origen") or "").strip()
        if sets_p:
            await db.execute(text(f"UPDATE aaces.participantes SET {', '.join(sets_p)} WHERE id = :pid"), params_p)
        sets_cp = []
        params_cp = {"cp": cp_id, "curso": curso_id}
        if "estado_pago" in payload:
            sets_cp.append("estado_pago = :estado_pago"); params_cp["estado_pago"] = (payload.get("estado_pago") or "").strip() or "pendiente"
        if "valor_pagado" in payload:
            try:
                val_pagado = float(payload.get("valor_pagado") or 0)
            except (TypeError, ValueError):
                val_pagado = 0.0
            sets_cp.append("valor_pagado = :valor_pagado"); params_cp["valor_pagado"] = val_pagado
        if "id_certificado" in payload:
            val = (payload.get("id_certificado") or "").strip() or None
            sets_cp.append("id_certificado = :id_certificado"); params_cp["id_certificado"] = val
        if "codigo_validacion" in payload:
            val = (payload.get("codigo_validacion") or "").strip().upper() or None
            sets_cp.append("codigo_validacion = :codigo_validacion"); params_cp["codigo_validacion"] = val
        if ("acreditado" in payload) or ("estado_acreditacion" in payload):
            acc = payload.get("acreditado")
            if acc is None:
                acc = payload.get("estado_acreditacion")
            sets_cp.append("estado_acreditacion = :estado_acreditacion"); params_cp["estado_acreditacion"] = bool(acc) if acc is not None else None
        if "fecha_emision_certificado" in payload:
            val = payload.get("fecha_emision_certificado") or None
            sets_cp.append("fecha_emision_certificado = :fecha_emision_certificado"); params_cp["fecha_emision_certificado"] = val
        if ("fecha_expiracion_certificado" in payload) or ("fecha_expiracion" in payload):
            raw = payload.get("fecha_expiracion_certificado") or payload.get("fecha_expiracion") or None
            val = None
            if raw not in (None, ""):
                s = str(raw).strip()
                val = None
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                    try:
                        val = datetime.strptime(s, fmt).date()
                        break
                    except ValueError:
                        continue
                if val is None:
                    try:
                        val = date.fromisoformat(s[:10])
                    except ValueError:
                        val = None
            sets_cp.append("fecha_expiracion = :fecha_expiracion"); params_cp["fecha_expiracion"] = val
        # Enable validation: generate codes and set vigencia dates
        habilitar = bool(payload.get("habilitar_validacion"))
        if habilitar:
            cur = await db.execute(text("SELECT fecha_fin, fecha_inicio, vigencia_meses, duracion_validacion FROM cursos WHERE id = :id"), {"id": curso_id})
            r = cur.fetchone()
            fi = r[1] if r else None
            ff = r[0] if r else None
            vig = r[2] if r else None
            dur_val = r[3] if r else None
            try:
                vm = int(vig) if vig is not None else int(dur_val) if dur_val is not None else None
            except Exception:
                vm = None
            emision = params_cp.get("fecha_emision_certificado")
            if emision is None:
                emision = ff or fi
                if emision is not None:
                    sets_cp.append("fecha_emision_certificado = :fecha_emision_certificado"); params_cp["fecha_emision_certificado"] = emision
            # Heredar fecha_fin del curso a fecha_inicio_vigencia
            if ff or fi:
                sets_cp.append("fecha_inicio_vigencia = :fecha_inicio_vigencia"); params_cp["fecha_inicio_vigencia"] = ff or fi
            if params_cp.get("id_certificado") in (None, ""):
                params_cp["id_certificado"] = f"CERT-{uuid.uuid4().hex[:8].upper()}"
                sets_cp.append("id_certificado = :id_certificado")
            if params_cp.get("codigo_validacion") in (None, ""):
                params_cp["codigo_validacion"] = uuid.uuid4().hex[:8].upper()
                sets_cp.append("codigo_validacion = :codigo_validacion")
            if (params_cp.get("fecha_expiracion") in (None, "")) and (emision is not None) and (vm is not None) and (vm > 0):
                exp_calc = await db.execute(text("SELECT (CAST(:emi AS date) + make_interval(months => CAST(:vig AS integer)))::date"), {"emi": emision, "vig": vm})
                params_cp["fecha_expiracion"] = exp_calc.scalar()
                sets_cp.append("fecha_expiracion = :fecha_expiracion")
        # Montos se gestionan vía pagos; no se actualizan manualmente aquí
        org_cupo = None
        if params_cp.get("codigo_validacion"):
            org_cupo = await cupo_service.verificar_participantes(db, [cp_id])
        if sets_cp:
            await db.execute(text(f"UPDATE aaces.curso_participante SET {', '.join(sets_cp)} WHERE id = :cp AND curso_id = :curso"), params_cp)
        await db.commit()
        cupo_service.avisar_en_segundo_plano(org_cupo)
        return {"updated": 1}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error actualizando participante: {str(e)}")

@router.get("/importar/plantilla")
async def plantilla_importar(identity: Identity = Depends(get_current_identity)):
    """Plantilla de Excel para importar participantes."""
    from app.services.importar import plantilla_xlsx
    return Response(
        content=plantilla_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla_participantes_AACES.xlsx"'},
    )


@router.post("/cursos/{curso_id}/importar")
async def importar_participantes(
    curso_id: str,
    archivo: UploadFile = File(...),
    confirmar: bool = Form(False),
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Con confirmar=false devuelve la vista previa sin guardar nada; con true inscribe
    a las filas válidas (mismo archivo). Inscribir no gasta constancias."""
    from app.services import importar as imp
    cid = await get_current_cliente_id(db, identity)
    own = (await db.execute(text("SELECT 1 FROM aaces.cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})).scalar()
    if not own:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    contenido = await archivo.read()
    analisis = await imp.analizar(db, curso_id, str(cid), contenido, archivo.filename or "")
    if not confirmar:
        return analisis
    if not analisis["resumen"]["a_importar"]:
        raise HTTPException(status_code=400, detail="No hay filas válidas para importar")
    return {**(await imp.importar(db, curso_id, str(cid), analisis)), "omitidos": analisis["resumen"]["inscrito"], "con_error": analisis["resumen"]["error"]}


@router.get("/cursos/{curso_id}/congruencia")
async def congruencia_curso(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Curso del catálogo, instructor y avisos de congruencia del DC-3 de este grupo."""
    from app.services.congruencia import revisar_curso
    cid = await get_current_cliente_id(db, identity)
    row = (await db.execute(text("SELECT catalogo_curso_id, instructor_id FROM aaces.cursos WHERE id = :id AND cliente_id = :cid"),
                            {"id": curso_id, "cid": cid})).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    rev = await revisar_curso(db, curso_id)
    rev.pop("organizacion_id", None)
    return {**rev, "catalogo_curso_id": str(row[0]) if row[0] else None, "instructor_id": str(row[1]) if row[1] else None}


@router.put("/cursos/{curso_id}/congruencia")
async def actualizar_congruencia_curso(
    curso_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Liga el grupo a un curso del catálogo y le asigna instructor (ambos de la propia organización)."""
    cid = await get_current_cliente_id(db, identity)
    org_id = await require_org_id(db, identity)
    own = (await db.execute(text("SELECT 1 FROM aaces.cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})).scalar()
    if not own:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    sets, params = [], {"id": curso_id}
    if "catalogo_curso_id" in payload:
        cat = payload.get("catalogo_curso_id") or None
        if cat and not (await db.execute(text("SELECT 1 FROM aaces.catalogo_cursos WHERE id = CAST(:c AS uuid) AND organizacion_id = CAST(:o AS uuid)"), {"c": cat, "o": org_id})).scalar():
            raise HTTPException(status_code=400, detail="Ese curso no está en tu catálogo")
        sets.append("catalogo_curso_id = CAST(:cat AS uuid)"); params["cat"] = cat
    if "instructor_id" in payload:
        ins = payload.get("instructor_id") or None
        if ins and not (await db.execute(text("SELECT 1 FROM aaces.instructores WHERE id = CAST(:i AS uuid) AND organizacion_id = CAST(:o AS uuid)"), {"i": ins, "o": org_id})).scalar():
            raise HTTPException(status_code=400, detail="Ese instructor no está en tu plantilla")
        sets.append("instructor_id = CAST(:ins AS uuid)"); params["ins"] = ins
    if sets:
        await db.execute(text(f"UPDATE aaces.cursos SET {', '.join(sets)}, fecha_actualizacion = now() WHERE id = :id"), params)
        await db.commit()
    return await congruencia_curso(curso_id, identity, db)


@router.post("/cursos/{curso_id}/acreditar")
async def acreditar_grupo(
    curso_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Acredita a los participantes que sí tomaron el curso y les da folio y QR.

    Es el único momento (junto con la emisión) en que se gastan constancias del
    plan. Todo o nada: si no alcanza el cupo no se acredita a nadie."""
    cid = await get_current_cliente_id(db, identity)
    curso = (await db.execute(
        text("SELECT fecha_inicio, fecha_fin, vigencia_meses, duracion_validacion FROM aaces.cursos WHERE id = :id AND cliente_id = :cid"),
        {"id": curso_id, "cid": cid},
    )).fetchone()
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    ids = [str(i) for i in (payload.get("curso_participante_ids") or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="Elige al menos un participante")

    filas = (await db.execute(
        text("""
            SELECT id, codigo_validacion, id_certificado, fecha_emision_certificado, fecha_expiracion
            FROM aaces.curso_participante
            WHERE curso_id = :curso AND id = ANY(CAST(:ids AS uuid[]))
        """),
        {"curso": curso_id, "ids": ids},
    )).fetchall()
    if len(filas) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Algún participante no pertenece a este curso")

    # Congruencia agente–curso–instructor: avisa (409) y registra quién decidió continuar
    if any(not f[1] for f in filas):
        from app.services.congruencia import exigir_confirmacion
        await exigir_confirmacion(db, curso_id, "acreditar", bool(payload.get("confirmar_avisos")),
                                  identity.user_id if identity.source == "usuario" else None)

    org_cupo = await cupo_service.verificar_participantes(db, ids)

    fi, ff, vig, dur_val = curso
    emision_def = ff or fi or date.today()
    try:
        meses = int(vig) if vig is not None else int(dur_val) if dur_val is not None else None
    except (TypeError, ValueError):
        meses = None

    nuevos = 0
    for cp_id, cod, id_cert, emision, expiracion in filas:
        cambios = {"estado_acreditacion": True}
        if not cod:
            nuevos += 1
            cambios["codigo_validacion"] = uuid.uuid4().hex[:8].upper()
            cambios["id_certificado"] = id_cert or f"CERT-{uuid.uuid4().hex[:8].upper()}"
            cambios["fecha_inicio_vigencia"] = emision_def
            if not emision:
                cambios["fecha_emision_certificado"] = emision_def
            if not expiracion and meses and meses > 0:
                cambios["fecha_expiracion"] = (await db.execute(
                    text("SELECT (CAST(:e AS date) + make_interval(months => CAST(:m AS integer)))::date"),
                    {"e": emision or emision_def, "m": meses},
                )).scalar()
        sets = ", ".join(f"{k} = :{k}" for k in cambios)
        await db.execute(text(f"UPDATE aaces.curso_participante SET {sets} WHERE id = :id"), {**cambios, "id": cp_id})
    await db.commit()
    cupo_service.avisar_en_segundo_plano(org_cupo)
    return {"acreditados": len(filas), "folios_nuevos": nuevos}


@router.delete("/cursos/{curso_id}/participantes/{cp_id}")
async def delete_participante_curso(
    curso_id: str,
    cp_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        # Eliminar dependencias (pagos y validaciones) antes de borrar el vínculo
        cod_row = await db.execute(text("SELECT codigo_validacion FROM aaces.curso_participante WHERE id = :cp"), {"cp": cp_id})
        cod = cod_row.scalar()
        await db.execute(text("DELETE FROM aaces.pagos WHERE curso_participante_id = :cp"), {"cp": cp_id})
        if cod:
            await db.execute(text("DELETE FROM aaces.validaciones_publicas WHERE codigo_validacion = :cod"), {"cod": cod})
        # Finalmente eliminar el curso_participante en ambos esquemas
        await db.execute(text("DELETE FROM aaces.curso_participante WHERE id = :cp AND curso_id = :curso"), {"cp": cp_id, "curso": curso_id})
        await db.commit()
        return {"deleted": 1}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error eliminando participante: {str(e)}")

# Constancias del curso (catálogo) y asignación múltiple

@router.get("/cursos/{curso_id}/constancias")
async def list_constancias_curso(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS constancias_curso (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
              nombre VARCHAR(200) NOT NULL,
              norma VARCHAR(200),
              fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(curso_id, nombre)
            )
            """
        ))
        res = await db.execute(text("SELECT id, nombre, norma FROM constancias_curso WHERE curso_id = :curso ORDER BY nombre"), {"curso": curso_id})
        rows = res.fetchall()
        return [{"id": r[0], "nombre": r[1], "norma": r[2]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listando constancias: {str(e)}")

@router.post("/cursos/{curso_id}/constancias")
async def create_constancia_curso(
    curso_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS constancias_curso (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
              nombre VARCHAR(200) NOT NULL,
              norma VARCHAR(200),
              fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(curso_id, nombre)
            )
            """
        ))
        nombre = (payload.get("nombre") or "").strip()
        norma = (payload.get("norma") or "").strip() or None
        if not nombre:
            raise HTTPException(status_code=400, detail="nombre requerido")
        await db.execute(text("INSERT INTO constancias_curso (curso_id, nombre, norma) VALUES (:curso, :n, :norma) ON CONFLICT (curso_id, nombre) DO UPDATE SET norma = EXCLUDED.norma"), {"curso": curso_id, "n": nombre, "norma": norma})
        await db.commit()
        return {"message": "Constancia registrada"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando constancia: {str(e)}")

@router.get("/cursos/{curso_id}/constancias/asignadas")
async def list_constancias_asignadas_curso(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS constancias_curso (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
              nombre VARCHAR(200) NOT NULL,
              norma VARCHAR(200),
              fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(curso_id, nombre)
            )
            """
        ))
        q = text(
            """
            SELECT 
                cp.id,
                NULL::UUID AS constancia_id,
                NULL::VARCHAR AS constancia_nombre,
                cp.participante_id,
                p.nombre AS participante_nombre,
                cp.id_certificado,
                cp.codigo_validacion,
                cp.estado_acreditacion,
                cp.fecha_emision_certificado,
                cp.fecha_expiracion
            FROM curso_participante cp
            JOIN participantes p ON p.id = cp.participante_id
            WHERE cp.curso_id = :curso
            ORDER BY p.nombre
            """
        )
        rows = (await db.execute(q, {"curso": curso_id})).fetchall()
        return [
            {
                "id": r[0],
                "constancia_id": r[1],
                "constancia_nombre": r[2],
                "participante_id": r[3],
                "participante_nombre": r[4],
                "id_certificado": r[5],
                "codigo_validacion": r[6],
                "estado_acreditacion": bool(r[7]) if r[7] is not None else None,
                "fecha_emision_certificado": r[8],
                "fecha_expiracion": r[9]
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listando constancias asignadas: {str(e)}")

@router.post("/cursos/{curso_id}/participantes/{cp_id}/constancias")
async def asignar_constancia_participante(
    curso_id: str,
    cp_id: str,
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text(
            """
            CREATE TABLE IF NOT EXISTS constancias_curso (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
              nombre VARCHAR(200) NOT NULL,
              norma VARCHAR(200),
              fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(curso_id, nombre)
            )
            """
        ))
        constancia_id = (payload.get("constancia_id") or "").strip()
        if not constancia_id:
            raise HTTPException(status_code=400, detail="constancia_id requerido")
        chk = await db.execute(text("SELECT 1 FROM constancias_curso WHERE id = :id AND curso_id = :curso"), {"id": constancia_id, "curso": curso_id})
        if chk.scalar() is None:
            raise HTTPException(status_code=404, detail="Constancia del curso no encontrada")
        id_cert = (payload.get("id_certificado") or "").strip() or None
        cod_val = (payload.get("codigo_validacion") or "").strip()
        cod_val = cod_val.upper() if cod_val else None
        acreditado = payload.get("estado_acreditacion")
        if acreditado is None:
            acreditado = payload.get("acreditado")
        emision = payload.get("fecha_emision_certificado") or None
        expiracion = payload.get("fecha_expiracion") or payload.get("fecha_expiracion_certificado") or None
        if id_cert is None:
            id_cert = f"CERT-{uuid.uuid4().hex[:8].upper()}"
        if cod_val is None:
            cod_val = uuid.uuid4().hex[:8].upper()
        if emision is None:
            cur = await db.execute(text("SELECT fecha_fin, fecha_inicio FROM cursos WHERE id = :id"), {"id": curso_id})
            row = cur.fetchone()
            if row:
                emision = row[0] or None
        if expiracion is None and emision is not None:
            vig_row = await db.execute(text("SELECT vigencia_meses FROM cursos WHERE id = :id"), {"id": curso_id})
            vig_val = vig_row.scalar()
            vig_m = None
            try:
                if vig_val is not None:
                    _v = int(vig_val)
                    if _v > 0:
                        vig_m = _v
            except Exception:
                vig_m = None
            if vig_m is not None:
                exp_calc = await db.execute(text("SELECT (CAST(:emi AS date) + make_interval(months => CAST(:vig AS integer)))::date"), {"emi": emision, "vig": vig_m})
                expiracion = exp_calc.scalar()
        org_cupo = await cupo_service.verificar_participantes(db, [cp_id])
        await db.execute(text("UPDATE curso_participante SET id_certificado = :idc, codigo_validacion = :cod, estado_acreditacion = COALESCE(:acr, estado_acreditacion), fecha_emision_certificado = COALESCE(:emi, fecha_emision_certificado), fecha_expiracion = COALESCE(:exp, fecha_expiracion) WHERE id = :cp AND curso_id = :curso"), {"idc": id_cert, "cod": cod_val, "acr": bool(acreditado) if acreditado is not None else None, "emi": emision, "exp": expiracion, "cp": cp_id, "curso": curso_id})
        await db.execute(text("UPDATE aaces.curso_participante SET id_certificado = :idc, codigo_validacion = :cod, estado_acreditacion = COALESCE(:acr, estado_acreditacion), fecha_emision_certificado = COALESCE(:emi, fecha_emision_certificado), fecha_expiracion = COALESCE(:exp, fecha_expiracion) WHERE id = :cp AND curso_id = :curso"), {"idc": id_cert, "cod": cod_val, "acr": bool(acreditado) if acreditado is not None else None, "emi": emision, "exp": expiracion, "cp": cp_id, "curso": curso_id})
        await db.commit()
        cupo_service.avisar_en_segundo_plano(org_cupo)
        return {"assigned": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error asignando constancia: {str(e)}")

@router.get("/dashboard/metrics")
async def get_cliente_dashboard_metrics(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cliente_id = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10,2) DEFAULT 0"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2)"))
        q_resumen = {
            "cursos_total": await db.execute(text("SELECT count(*) FROM cursos WHERE cliente_id = :cid"), {"cid": cliente_id}),
            "cursos_activos": await db.execute(text("SELECT count(*) FROM cursos WHERE cliente_id = :cid AND estado='activo'"), {"cid": cliente_id}),
            "cursos_finalizados": await db.execute(text("SELECT count(*) FROM cursos WHERE cliente_id = :cid AND estado='finalizado'"), {"cid": cliente_id}),
            "participantes_total": await db.execute(text("SELECT count(distinct participante_id) FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid"), {"cid": cliente_id}),
            "acreditados": await db.execute(text("SELECT count(*) FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid AND cp.estado_acreditacion = true"), {"cid": cliente_id}),
            "validaciones": await db.execute(text("SELECT count(*) FROM validaciones_publicas v JOIN curso_participante cp ON cp.codigo_validacion = v.codigo_validacion JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid"), {"cid": cliente_id}),
            "pagos_recibidos": await db.execute(text("SELECT coalesce(sum(monto),0) FROM pagos WHERE cliente_id = :cid AND estado_pago='completado'"), {"cid": cliente_id}),
            "pagos_pendientes": await db.execute(text("SELECT coalesce(sum(monto),0) FROM pagos WHERE cliente_id = :cid AND estado_pago='pendiente'"), {"cid": cliente_id}),
        }
        resumen = {
            k: float(v.scalar() or 0) if k in ["pagos_recibidos", "pagos_pendientes"] else int(v.scalar() or 0)
            for k, v in q_resumen.items()
        }
        ingresos = await db.execute(text("SELECT to_char(date_trunc('month', fecha_pago), 'YYYY-MM') AS mes, sum(monto) AS total, count(*) AS cantidad FROM pagos WHERE cliente_id = :cid AND estado_pago='completado' GROUP BY 1 ORDER BY 1"), {"cid": cliente_id})
        ingresos_mes_rows = ingresos.fetchall()
        ciudad = await db.execute(text("SELECT c.ciudad, sum(p.monto) AS total, count(p.id) AS cantidad FROM pagos p JOIN curso_participante cp ON cp.id = p.curso_participante_id JOIN cursos c ON c.id = cp.curso_id WHERE p.cliente_id = :cid AND p.estado_pago = 'completado' GROUP BY c.ciudad ORDER BY total DESC"), {"cid": cliente_id})
        ciudad_rows = ciudad.fetchall()
        prox = await db.execute(text("SELECT count(*) FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid AND cp.estado_acreditacion = true AND cp.fecha_expiracion BETWEEN now() AND now() + interval '30 days'"), {"cid": cliente_id})
        proximos_vencer = prox.scalar()
        precios_row = await db.execute(text("SELECT avg(precio_base) AS avg_base, avg(precio_promocional) AS avg_promo, sum(CASE WHEN precio_promocional IS NOT NULL THEN 1 ELSE 0 END) AS con_promo, count(*) AS total FROM cursos WHERE cliente_id = :cid"), {"cid": cliente_id})
        precios = precios_row.fetchone()
        cursos_estado_rows = await db.execute(text("SELECT estado, count(*) AS cantidad FROM cursos WHERE cliente_id = :cid GROUP BY estado"), {"cid": cliente_id})
        cursos_estado = cursos_estado_rows.fetchall()
        pagos_conv_rows = await db.execute(text("SELECT sum(CASE WHEN estado_pago = 'completado' THEN 1 ELSE 0 END) AS completados, sum(CASE WHEN estado_pago = 'fallido' THEN 1 ELSE 0 END) AS fallidos FROM pagos WHERE cliente_id = :cid AND fecha_pago >= now() - interval '30 days'"), {"cid": cliente_id})
        pagos_conv = pagos_conv_rows.fetchone()
        ingresos_estimados_rows = await db.execute(text("SELECT sum(COALESCE(c.precio_base, c.precio_promocional) * (SELECT count(*) FROM curso_participante cp WHERE cp.curso_id = c.id)) AS estimado FROM cursos c WHERE c.cliente_id = :cid AND c.curso_padre_id IS NULL AND ((c.fecha_inicio IS NOT NULL AND c.fecha_inicio >= CURRENT_DATE) OR (c.fecha_inicio IS NULL AND c.fecha_fin IS NOT NULL AND c.fecha_fin >= CURRENT_DATE))"), {"cid": cliente_id})
        ingresos_estimados = ingresos_estimados_rows.scalar()
        part_prom_rows = await db.execute(text("SELECT COALESCE(avg(cnt), 0) FROM (SELECT count(*) AS cnt FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid GROUP BY cp.curso_id) t"), {"cid": cliente_id})
        participantes_promedio = part_prom_rows.scalar()
        tasa_acr_rows = await db.execute(text("SELECT COALESCE(sum(CASE WHEN cp.estado_acreditacion = true THEN 1 ELSE 0 END)::float / NULLIF(count(*), 0) * 100, 0) FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid"), {"cid": cliente_id})
        tasa_acreditacion = tasa_acr_rows.scalar()
        mod_rows = await db.execute(text("SELECT c.modalidad, sum(p.monto) AS total, count(p.id) AS cantidad FROM cursos c LEFT JOIN curso_participante cp ON cp.curso_id = c.id LEFT JOIN pagos p ON p.curso_participante_id = cp.id AND p.estado_pago = 'completado' WHERE c.cliente_id = :cid GROUP BY c.modalidad"), {"cid": cliente_id})
        ingresos_por_modalidad_rows = mod_rows.fetchall()
        return {
            "resumen": resumen,
            "ingresos_mes": [{"mes": r[0], "total": float(r[1] or 0), "cantidad": int(r[2] or 0)} for r in ingresos_mes_rows],
            "por_ciudad": [{"ciudad": r[0], "total": float(r[1] or 0), "cantidad": int(r[2] or 0)} for r in ciudad_rows],
            "proximos_vencer": int(proximos_vencer or 0),
            "precios": {
                "promedio_base": float((precios or (0,))[0] or 0),
                "promedio_promocional": float((precios or (0,0))[1] or 0),
                "porcentaje_con_promocion": round((float((precios or (0,0,0,0))[2] or 0) / max(int((precios or (0,0,0,0))[3] or 1), 1)) * 100, 2),
            },
            "cursos_por_estado": [{"estado": r[0], "cantidad": int(r[1] or 0)} for r in cursos_estado],
            "pagos_conversion_30d": {
                "completados": int((pagos_conv or (0,0))[0] or 0),
                "fallidos": int((pagos_conv or (0,0))[1] or 0),
                "tasa_conversion": round((int((pagos_conv or (0,0))[0] or 0) / max(int(((pagos_conv or (0,0))[0] or 0)) + int(((pagos_conv or (0,0))[1] or 0)), 1)) * 100, 2)
            },
            "ingresos_estimados_proximos": float(ingresos_estimados or 0),
            "participantes_promedio_por_curso": float(participantes_promedio or 0),
            "tasa_acreditacion": float(tasa_acreditacion or 0),
            "ingresos_por_modalidad": [{"modalidad": r[0], "total": float(r[1] or 0), "cantidad": int(r[2] or 0)} for r in ingresos_por_modalidad_rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en métricas del cliente: {str(e)}")

@router.get("/constancias")
async def list_constancias_cliente(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        q = text(
            """
            SELECT 
                cp.id,
                c.id AS curso_id,
                c.nombre AS curso_nombre,
                c.ciudad,
                p.id AS participante_id,
                p.nombre AS participante_nombre,
                cp.id_certificado,
                cp.codigo_validacion,
                cp.estado_acreditacion,
                cp.fecha_emision_certificado,
                cp.fecha_expiracion,
                cp.certificado_url,
                COALESCE(c.fecha_fin, c.fecha_inicio) AS fecha_curso,
                cap.nombre AS capacitador_nombre,
                (
                  SELECT STRING_AGG(cc.nombre, ', ' ORDER BY cc.nombre)
                  FROM constancias_curso cc
                  WHERE cc.curso_id = c.id
                ) AS constancias_asociadas
            FROM curso_participante cp
            JOIN cursos c ON c.id = cp.curso_id
            JOIN participantes p ON p.id = cp.participante_id
            LEFT JOIN capacitadores cap ON cap.id = c.capacitador_id
            WHERE c.cliente_id = :cid
            ORDER BY cp.fecha_emision_certificado DESC NULLS LAST, p.nombre
            """
        )
        rows = (await db.execute(q, {"cid": cid})).fetchall()
        return [
            {
                "id": r[0],
                "curso_id": r[1],
                "curso_nombre": r[2],
                "ciudad": r[3],
                "participante_id": r[4],
                "participante_nombre": r[5],
                "id_certificado": r[6],
                "codigo_validacion": r[7],
                "estado_acreditacion": bool(r[8]) if r[8] is not None else None,
                "fecha_emision_certificado": r[9],
                "fecha_expiracion": r[10],
                "certificado_url": r[11],
                "fecha_curso": r[12],
                "capacitador_nombre": r[13],
                "constancias_asociadas": r[14],
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tipos-curso")
async def create_tipo_curso(
    nombre: str,
    costo_por_persona: float,
    descripcion: Optional[str] = None,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cliente_id = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(
            text(
                "INSERT INTO tipos_curso (cliente_id, nombre, descripcion, costo_por_persona) VALUES (:cid, :n, :d, :c) ON CONFLICT (cliente_id, nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion, costo_por_persona = EXCLUDED.costo_por_persona"
            ),
            {"cid": cliente_id, "n": nombre, "d": descripcion, "c": costo_por_persona}
        )
        await db.commit()
        return {"message": "Tipo de curso registrado"}
    except Exception as e:
        await db.rollback()
        msg = str(e)
        if "relation \"tipos_curso\" does not exist" in msg or "no existe la relación" in msg:
            try:
                await db.execute(text("SET LOCAL search_path TO aaces"))
                await db.execute(text(
                    """
                    CREATE TABLE IF NOT EXISTS tipos_curso (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                      nombre VARCHAR(200) NOT NULL,
                      descripcion TEXT,
                      costo_por_persona NUMERIC(10,2) DEFAULT 0,
                      estado VARCHAR(20) DEFAULT 'activo',
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                ))
                await db.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_curso_cliente_nombre ON tipos_curso (cliente_id, nombre)"
                ))
                await db.execute(
                    text(
                        "INSERT INTO tipos_curso (cliente_id, nombre, descripcion, costo_por_persona) VALUES (:cid, :n, :d, :c) ON CONFLICT (cliente_id, nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion, costo_por_persona = EXCLUDED.costo_por_persona"
                    ),
                    {"cid": cliente_id, "n": nombre, "d": descripcion, "c": costo_por_persona}
                )
                await db.commit()
                return {"message": "Tipo de curso registrado"}
            except Exception as e2:
                await db.rollback()
                raise HTTPException(status_code=500, detail=f"Error creando tipos_curso: {str(e2)}")
        raise HTTPException(status_code=500, detail=f"Error creando tipo de curso: {msg}")

@router.delete("/tipos-curso/{tipo_id}")
async def delete_tipo_curso(
    tipo_id: str,
    migrate_to: Optional[str] = None,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cliente_id = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        row = await db.execute(text("SELECT nombre FROM tipos_curso WHERE id = :id AND cliente_id = :cid"), {"id": tipo_id, "cid": cliente_id})
        r = row.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Tipo de curso no encontrado")
        old_nombre = r[0]
        cnt = await db.execute(text("SELECT COUNT(1) FROM cursos WHERE cliente_id = :cid AND nombre = :n"), {"cid": cliente_id, "n": old_nombre})
        used = int(cnt.scalar() or 0)
        if used > 0 and not migrate_to:
            raise HTTPException(status_code=409, detail="No se puede eliminar: hay cursos que usan este tipo. Proporcione migrate_to")
        new_nombre = None
        if migrate_to:
            row2 = await db.execute(text("SELECT id, nombre FROM tipos_curso WHERE id = :id AND cliente_id = :cid"), {"id": migrate_to, "cid": cliente_id})
            r2 = row2.fetchone()
            if not r2:
                raise HTTPException(status_code=404, detail="Tipo de curso destino no encontrado")
            new_id = r2[0]
            new_nombre = r2[1]
            if (new_nombre or "").strip().lower() == (old_nombre or "").strip().lower():
                raise HTTPException(status_code=400, detail="El tipo destino tiene el mismo nombre; elige otro")
            await db.execute(text("UPDATE cursos SET nombre = :new WHERE cliente_id = :cid AND nombre = :old"), {"new": new_nombre, "cid": cliente_id, "old": old_nombre})
            await db.execute(text("INSERT INTO grupo_curso_items (grupo_id, tipo_curso_id) SELECT grupo_id, :new FROM grupo_curso_items WHERE tipo_curso_id = :old ON CONFLICT (grupo_id, tipo_curso_id) DO NOTHING"), {"new": new_id, "old": tipo_id})
        await db.execute(text("DELETE FROM tipos_curso WHERE id = :id"), {"id": tipo_id})
        await db.commit()
        return {"deleted": 1, "migrated_cursos": used if migrate_to else 0}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error eliminando tipo de curso: {str(e)}")

@router.get("/tipos-curso/{tipo_id}/migracion-conteo")
async def conteo_migracion_tipo_curso(
    tipo_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cliente_id = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        row = await db.execute(text("SELECT nombre FROM tipos_curso WHERE id = :id AND cliente_id = :cid"), {"id": tipo_id, "cid": cliente_id})
        r = row.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Tipo de curso no encontrado")
        nombre = r[0]
        cnt = await db.execute(text("SELECT COUNT(1) FROM cursos WHERE cliente_id = :cid AND nombre = :n"), {"cid": cliente_id, "n": nombre})
        used = int(cnt.scalar() or 0)
        return {"usos": used}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo conteo de migración: {str(e)}")

@router.get("/tipos-curso")
async def list_tipos_curso(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cliente_id = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        res = await db.execute(
            text(
                "SELECT id, nombre, descripcion, costo_por_persona, estado FROM tipos_curso WHERE cliente_id = :cid ORDER BY nombre"
            ),
            {"cid": cliente_id}
        )
        rows = res.fetchall()
        return [{"id": r[0], "nombre": r[1], "descripcion": r[2], "costo_por_persona": float(r[3] or 0), "estado": r[4]} for r in rows]
    except Exception as e:
        msg = str(e)
        if "relation \"tipos_curso\" does not exist" in msg or "no existe la relación" in msg:
            try:
                await db.execute(text("SET LOCAL search_path TO aaces"))
                await db.execute(text(
                    """
                    CREATE TABLE IF NOT EXISTS tipos_curso (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                      nombre VARCHAR(200) NOT NULL,
                      descripcion TEXT,
                      costo_por_persona NUMERIC(10,2) DEFAULT 0,
                      estado VARCHAR(20) DEFAULT 'activo',
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                ))
                await db.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_curso_cliente_nombre ON tipos_curso (cliente_id, nombre)"
                ))
                # Reintentar consulta
                res = await db.execute(
                    text(
                        "SELECT id, nombre, descripcion, costo_por_persona, estado FROM tipos_curso WHERE cliente_id = :cid ORDER BY nombre"
                    ),
                    {"cid": cliente_id}
                )
                rows = res.fetchall()
                return [{"id": r[0], "nombre": r[1], "descripcion": r[2], "costo_por_persona": float(r[3] or 0), "estado": r[4]} for r in rows]
            except Exception as e2:
                raise HTTPException(status_code=500, detail=f"Error creando tipos_curso: {str(e2)}")
        raise HTTPException(status_code=500, detail=f"Error listando tipos de curso: {msg}")
@router.put("/me/password")
async def change_my_password(
    payload: dict,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        current = payload.get("current_password")
        new = payload.get("new_password")
        if not new or len(new) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
        # Tabla según el esquema de identidad (nunca asumir `clientes`).
        if identity.source == "usuario":
            tabla, con_must_change = "aaces.usuarios", True
        elif identity.source == "cliente":
            tabla, con_must_change = "aaces.clientes", True
        elif identity.source == "plataforma":
            tabla, con_must_change = "aaces.usuarios_plataforma", False
        else:
            raise HTTPException(status_code=403, detail="Tipo de usuario no soportado")
        # Obtener hash actual
        cols = "password_hash, must_change_password" if con_must_change else "password_hash"
        res = await db.execute(
            text(f"SELECT {cols} FROM {tabla} WHERE id = :id"),
            {"id": identity.user_id},
        )
        row = res.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        from app.services.security import security_service
        # Validar current si se suministra, o permitir si debe cambiarse obligatoriamente
        if current:
            if not security_service.verify_password(current, row[0]):
                raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
        elif con_must_change and not row[1]:
            raise HTTPException(status_code=400, detail="Debe proporcionar la contraseña actual")
        # Actualizar
        new_hash = security_service.hash_password(new)
        set_extra = ", must_change_password = false" if con_must_change else ""
        await db.execute(
            text(f"UPDATE {tabla} SET password_hash = :ph{set_extra}, intentos_fallidos = 0, bloqueado_hasta = NULL, fecha_actualizacion = now() WHERE id = :id"),
            {"ph": new_hash, "id": identity.user_id},
        )
        await db.commit()
        return {"updated": 1}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cambiando contraseña: {str(e)}")
@router.post("/cursos/{curso_id}/migrar-datos")
async def migrar_datos_curso(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        own = await db.execute(text("SELECT 1 FROM aaces.cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        return {"migrado": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error migrando datos del curso: {str(e)}")

@router.post("/cursos/migrar/todos")
async def migrar_todos_mis_cursos(
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        return {"migrados": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error migrando todos los cursos: {str(e)}")
# Eliminar curso del cliente, incluyendo subcursos
@router.delete("/cursos/{curso_id}")
async def delete_curso(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    try:
        cid = await get_current_cliente_id(db, identity)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        own = await db.execute(text("SELECT 1 FROM cursos WHERE id = :id AND cliente_id = :cid"), {"id": curso_id, "cid": cid})
        if own.scalar() is None:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        rows = await db.execute(text("SELECT id FROM cursos WHERE curso_padre_id = :pid"), {"pid": curso_id})
        children = [str(r[0]) for r in rows.fetchall()]
        if children:
            await db.execute(text("DELETE FROM cursos WHERE id = ANY(:ids)"), {"ids": children})
        await db.execute(text("DELETE FROM cursos WHERE id = :id"), {"id": curso_id})
        await db.commit()
        return {"deleted": 1 + len(children)}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error eliminando curso: {str(e)}")
