from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, text, or_, cast
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.models import CursoParticipante, ValidacionPublica
from app.schemas import ValidacionRequest, ValidacionResponse, ValidacionPublicaResponse
from app.services.security import security_service, rate_limiter
from app.core.config import settings
from app.core.logging import audit_logger
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/validar-certificado", response_model=ValidacionResponse)
async def validar_certificado(
    request: Request,
    validacion_data: ValidacionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate a certificate using its validation code.
    Implements rate limiting and tracks validation attempts.
    """
    # Get client IP
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "")
    
    # Check rate limiting
    rate_limit_key = f"validation:{client_ip}"
    if rate_limiter.is_rate_limited(
        rate_limit_key,
        settings.MAX_VALIDATION_ATTEMPTS,
        settings.VALIDATION_LOCKOUT_MINUTES * 60
    ):
        remaining_time = settings.VALIDATION_LOCKOUT_MINUTES
        security_service.log_security_event(
            "validation_rate_limited",
            None,
            {
                "ip": client_ip,
                "code": validacion_data.codigo_validacion,
                "reason": "too_many_attempts"
            }
        )
        return ValidacionResponse(
            valido=False,
            mensaje=f"Demasiados intentos. Por favor, intente nuevamente en {remaining_time} minutos.",
            intentos_restantes=0
        )
    
    # Get remaining attempts
    remaining_attempts = rate_limiter.get_remaining_attempts(
        rate_limit_key,
        settings.MAX_VALIDATION_ATTEMPTS,
        settings.VALIDATION_LOCKOUT_MINUTES * 60
    )
    
    try:
        await db.execute(text("SET LOCAL search_path TO aaces"))
        input_code = validacion_data.codigo_validacion.upper()
        sel_cp = text(
            """
            SELECT id, curso_id, participante_id, estado_pago, fecha_expiracion, estado_acreditacion,
                   calificacion, fecha_emision_certificado, id_certificado, codigo_validacion
            FROM curso_participante
            WHERE UPPER(codigo_validacion) = :code OR UPPER(id_certificado) = :code
            LIMIT 1
            """
        )
        cp_row = (await db.execute(sel_cp, {"code": input_code})).fetchone()
        curso_participante = None
        if cp_row:
            from types import SimpleNamespace
            curso_participante = SimpleNamespace(
                id=cp_row[0], curso_id=cp_row[1], participante_id=cp_row[2], estado_pago=cp_row[3],
                fecha_expiracion=cp_row[4], estado_acreditacion=cp_row[5], calificacion=cp_row[6],
                fecha_emision_certificado=cp_row[7], id_certificado=cp_row[8], codigo_validacion=cp_row[9]
            )
        
        if not curso_participante:
            return ValidacionResponse(
                valido=False,
                mensaje="Código de validación no encontrado.",
                intentos_restantes=remaining_attempts - 1
            )
        
        # Check if certificate is still valid
        from datetime import date
        if (curso_participante.fecha_expiracion and 
            curso_participante.fecha_expiracion < date.today()):
            await _log_validation_attempt(
                db, curso_participante.codigo_validacion, client_ip, user_agent, False
            )
            
            return ValidacionResponse(
                valido=False,
                mensaje="Certificado expirado.",
                intentos_restantes=remaining_attempts - 1
            )
        
        # Check if participant is accredited, with exception for paid + course today
        if not curso_participante.estado_acreditacion:
            from datetime import date
            allow_during_course = False
            try:
                if str(curso_participante.estado_pago or '').lower() == 'pagado':
                    res_curso = await db.execute(text("SELECT fecha_inicio, fecha_fin FROM cursos WHERE id = :id"), {"id": curso_participante.curso_id})
                    row = res_curso.fetchone()
                    if row:
                        fi, ff = row[0], row[1]
                        today = date.today()
                        fi_d = fi.date() if hasattr(fi, 'date') else fi
                        ff_d = ff.date() if hasattr(ff, 'date') else ff
                        if fi_d and ff_d:
                            allow_during_course = (fi_d <= today <= ff_d)
                        elif fi_d:
                            allow_during_course = (fi_d == today)
            except Exception:
                allow_during_course = False
            if not allow_during_course:
                await _log_validation_attempt(
                    db, curso_participante.codigo_validacion, client_ip, user_agent, False
                )
                return ValidacionResponse(
                    valido=False,
                    mensaje="Participante no acreditado.",
                    intentos_restantes=remaining_attempts - 1
                )
        
        # Successful validation
        await _log_validation_attempt(
            db, curso_participante.codigo_validacion, client_ip, user_agent, True
        )
        
        # Get related data without ORM relationship loading to avoid schema column mismatches
        cp = curso_participante
        p_res = await db.execute(text("SELECT nombre, apellido FROM participantes WHERE id = :id LIMIT 1"), {"id": cp.participante_id})
        p_row = p_res.fetchone()
        c_res = await db.execute(text("SELECT nombre, codigo_curso, fecha_inicio, fecha_fin, duracion_horas FROM cursos WHERE id = :id LIMIT 1"), {"id": cp.curso_id})
        c_row = c_res.fetchone()
        datos_certificado = {
            "nombre_participante": (f"{(p_row[0] or '')} {(p_row[1] or '')}").strip() if p_row else None,
            "nombre_curso": c_row[0] if c_row else None,
            "codigo_curso": c_row[1] if c_row else None,
            "fecha_inicio": (c_row[2].isoformat() if c_row and c_row[2] else None),
            "fecha_fin": (c_row[3].isoformat() if c_row and c_row[3] else None),
            "duracion_horas": c_row[4] if c_row else None,
            "calificacion": float(cp.calificacion) if cp.calificacion else None,
            "fecha_emision": cp.fecha_emision_certificado.isoformat() if cp.fecha_emision_certificado else None,
            "fecha_expiracion": cp.fecha_expiracion.isoformat() if cp.fecha_expiracion else None,
            "id_certificado": cp.id_certificado
        }

        empresa = None
        emp_res = await db.execute(text("SELECT empresa_contratante FROM cursos WHERE id = :id"), {"id": cp.curso_id})
        emp_row = emp_res.fetchone()
        empresa = emp_row[0] if emp_row else None
        constancias: List[str] = []
        normas: List[str] = []
        const_res = await db.execute(text(
            """
            SELECT nombre, COALESCE(norma, '')
            FROM constancias_curso
            WHERE curso_id = :curso
            ORDER BY nombre
            """
        ), {"curso": cp.curso_id})
        rows = const_res.fetchall()
        constancias = [ (f"{r[0]} ({r[1]})" if r[1] else r[0]) for r in rows ]
        normas = [ r[1] for r in rows if r[1] ]
        from datetime import date
        today = date.today()
        fi = c_row[2] if c_row else None
        ff = c_row[3] if c_row else None
        fi_d = fi.date() if hasattr(fi, 'date') else fi
        ff_d = ff.date() if hasattr(ff, 'date') else ff
        en_ventana = False
        if fi_d and ff_d:
            en_ventana = (fi_d <= today <= ff_d)
        elif fi_d:
            en_ventana = (fi_d == today)
        activo = ((bool(cp.estado_acreditacion)) or ((str(cp.estado_pago or '').lower() == 'pagado') and en_ventana)) and (cp.fecha_expiracion is None or cp.fecha_expiracion >= today)
        estado_texto = "Activo" if activo else "Vencido"
        datos_certificado.update({
            "constancias": constancias,
            "constancias_normas": normas,
            "capacitador": empresa or "",
            "estado": estado_texto
        })
        
        security_service.log_security_event(
            "successful_validation",
            None,
            {
                "ip": client_ip,
                "code": validacion_data.codigo_validacion,
                "participant_id": str(cp.participante_id),
                "course_id": str(cp.curso_id)
            }
        )
        
        return ValidacionResponse(
            valido=True,
            mensaje="Certificado válido y verificado exitosamente.",
            certificado=datos_certificado
        )
        
    except Exception as e:
        logger.error(f"Error validating certificate: {e}")
        await _log_validation_attempt(
            db, validacion_data.codigo_validacion, client_ip, user_agent, False
        )
        
        return ValidacionResponse(
            valido=False,
            mensaje=f"Error al validar el certificado: {str(e)}",
            intentos_restantes=remaining_attempts - 1
        )

@router.get("/validaciones/{codigo_validacion}", response_model=List[ValidacionPublicaResponse])
async def get_validation_history(
    codigo_validacion: str,
    db: AsyncSession = Depends(get_db)
):
    """Get validation history for a specific validation code."""
    result = await db.execute(
        select(ValidacionPublica)
        .where(ValidacionPublica.codigo_validacion == codigo_validacion.upper())
        .order_by(ValidacionPublica.fecha_validacion.desc())
        .limit(50)
    )
    validaciones = result.scalars().all()
    
    return validaciones

@router.get("/estadisticas-validacion")
async def get_validation_statistics(
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get validation statistics."""
    from datetime import datetime
    
    query = select(
        func.count(ValidacionPublica.id).label('total_validaciones'),
        func.sum(func.case((ValidacionPublica.resultado == True, 1), else_=0)).label('validaciones_exitosas'),
        func.sum(func.case((ValidacionPublica.resultado == False, 1), else_=0)).label('validaciones_fallidas'),
        func.count(func.distinct(ValidacionPublica.ip_validacion)).label('ips_unicas')
    )
    
    if fecha_desde:
        fecha_desde_dt = datetime.fromisoformat(fecha_desde)
        query = query.where(ValidacionPublica.fecha_validacion >= fecha_desde_dt)
    
    if fecha_hasta:
        fecha_hasta_dt = datetime.fromisoformat(fecha_hasta)
        query = query.where(ValidacionPublica.fecha_validacion <= fecha_hasta_dt)
    
    result = await db.execute(query)
    stats = result.one()
    
    return {
        "total_validaciones": stats.total_validaciones or 0,
        "validaciones_exitosas": stats.validaciones_exitosas or 0,
        "validaciones_fallidas": stats.validaciones_fallidas or 0,
        "ips_unicas": stats.ips_unicas or 0,
        "tasa_exito": round((stats.validaciones_exitosas or 0) / max(stats.total_validaciones, 1) * 100, 2)
    }

async def _log_validation_attempt(
    db: AsyncSession,
    codigo_validacion: str,
    ip_address: str,
    user_agent: str,
    resultado: bool
):
    """Log a validation attempt."""
    try:
        try:
            await db.rollback()
        except Exception:
            pass
        await db.execute(text("SET LOCAL search_path TO aaces"))
        q = text(
            """
            INSERT INTO validaciones_publicas (codigo_validacion, ip_validacion, user_agent, resultado, intentos)
            VALUES (:cod, CAST(:ip AS INET), :ua, :res, 1)
            ON CONFLICT (codigo_validacion, ip_validacion) DO UPDATE SET
              resultado = EXCLUDED.resultado,
              intentos = validaciones_publicas.intentos + 1,
              user_agent = EXCLUDED.user_agent,
              fecha_validacion = CURRENT_TIMESTAMP
            """
        )
        await db.execute(q, {"cod": codigo_validacion.upper(), "ip": ip_address, "ua": user_agent, "res": resultado})
        await db.commit()
    except Exception as e:
        logger.error(f"Error logging validation attempt: {e}")
        await db.rollback()

@router.get("/constancias/{codigo_validacion}")
async def get_constancias_por_codigo(
    codigo_validacion: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        await db.execute(text("SET LOCAL search_path TO aaces"))
        code = (codigo_validacion or "").upper().strip()
        sel_cp = text(
            """
            SELECT curso_id
            FROM curso_participante
            WHERE UPPER(codigo_validacion) = :code OR UPPER(id_certificado) = :code
            LIMIT 1
            """
        )
        row = (await db.execute(sel_cp, {"code": code})).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Código de validación no encontrado")
        curso_id = row[0]
        res = await db.execute(text(
            """
            SELECT nombre, COALESCE(norma, '')
            FROM constancias_curso
            WHERE curso_id = :curso
            ORDER BY nombre
            """
        ), {"curso": curso_id})
        rs = res.fetchall()
        consts = [ (f"{r[0]} ({r[1]})" if r[1] else r[0]) for r in rs ]
        normas = [ r[1] for r in rs if r[1] ]
        return {
            "codigo_validacion": code,
            "curso_id": str(curso_id),
            "constancias": consts,
            "constancias_normas": normas
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo constancias: {str(e)}")
