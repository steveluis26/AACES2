from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, text
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date
import secrets
import string

from app.core.database import get_db
from app.models import Cliente, Curso, CursoParticipante, Participante, Pago, AuditoriaCambio
# Evitar uso de ORM en este módulo para prevenir conflictos de mapeo
from app.services.security import security_service
from app.schemas import ClienteResponse, PaginatedResponse
from app.api.v1.endpoints.auth import require_superadmin, get_current_user_data
from app.core.logging import audit_logger
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/dashboard/metrics")
async def get_admin_dashboard_metrics(
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Obtener métricas generales del dashboard administrativo"""
    try:
        hoy = datetime.utcnow()
        seis_meses_atras = hoy - timedelta(days=180)
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10,2) DEFAULT 0"))
        await db.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2)"))
        tc = await db.execute(text("SELECT count(*) FROM clientes WHERE estado='activo'"))
        total_clientes = tc.scalar()
        cats = await db.execute(text("SELECT categoria, count(*) FROM clientes WHERE estado='activo' GROUP BY categoria"))
        categorias_data = cats.fetchall()
        tcu = await db.execute(text("SELECT count(*) FROM cursos WHERE estado='activo'"))
        total_cursos = tcu.scalar()
        tcap = await db.execute(text("SELECT count(*) FROM capacitadores WHERE acceso_activo = true"))
        total_capacitadores = tcap.scalar()
        tpar = await db.execute(text("SELECT count(distinct participante_id) FROM curso_participante"))
        total_participantes = tpar.scalar()
        tcert = await db.execute(text("SELECT count(*) FROM curso_participante WHERE estado_acreditacion = true"))
        total_certificados = tcert.scalar()
        ingresos = await db.execute(text("SELECT date_trunc('month', fecha_pago) as mes, sum(monto) as total, count(*) as cantidad FROM pagos WHERE estado_pago='completado' AND fecha_pago >= :desde GROUP BY 1 ORDER BY 1"), {"desde": seis_meses_atras})
        ingresos_data = ingresos.fetchall()
        val = await db.execute(text("SELECT count(*) as total, sum(CASE WHEN resultado = true THEN 1 ELSE 0 END) as exitosas, sum(CASE WHEN resultado = false THEN 1 ELSE 0 END) as fallidas FROM validaciones_publicas WHERE fecha_validacion >= :desde"), {"desde": hoy - timedelta(days=30)})
        validaciones_data = val.fetchone()
        prox = await db.execute(text("SELECT count(*) FROM curso_participante WHERE estado_acreditacion = true AND fecha_expiracion BETWEEN now() AND now() + interval '30 days'"))
        proximos_vencer = prox.scalar()
        precios_row = await db.execute(text("SELECT avg(precio_base) AS avg_base, avg(precio_promocional) AS avg_promo, sum(CASE WHEN precio_promocional IS NOT NULL THEN 1 ELSE 0 END) AS con_promo, count(*) AS total FROM cursos"))
        precios = precios_row.fetchone()
        cursos_estado_rows = await db.execute(text("SELECT estado, count(*) AS cantidad FROM cursos GROUP BY estado"))
        cursos_estado = cursos_estado_rows.fetchall()
        pagos_estado_rows = await db.execute(text("SELECT estado_pago, count(*) AS cantidad, sum(monto) AS total FROM pagos GROUP BY estado_pago"))
        pagos_estado = pagos_estado_rows.fetchall()
        pagos_30d_rows = await db.execute(text("SELECT sum(CASE WHEN estado_pago = 'completado' THEN 1 ELSE 0 END) AS completados, sum(CASE WHEN estado_pago = 'fallido' THEN 1 ELSE 0 END) AS fallidos FROM pagos WHERE fecha_pago >= now() - interval '30 days'"))
        pagos_30d = pagos_30d_rows.fetchone()
        ingresos_total_row = await db.execute(text("SELECT coalesce(sum(monto), 0) FROM pagos WHERE estado_pago = 'completado'"))
        ingresos_total = ingresos_total_row.scalar()
        ingresos_pendientes_row = await db.execute(text("SELECT coalesce(sum(monto), 0) FROM pagos WHERE estado_pago = 'pendiente'"))
        ingresos_pendientes = ingresos_pendientes_row.scalar()
        ingresos_estimados_rows = await db.execute(text("SELECT sum(COALESCE(c.precio_promocional, c.precio_base) * (SELECT count(*) FROM curso_participante cp WHERE cp.curso_id = c.id)) AS estimado FROM cursos c WHERE c.curso_padre_id IS NULL AND ((c.fecha_inicio IS NOT NULL AND c.fecha_inicio >= CURRENT_DATE) OR (c.fecha_inicio IS NULL AND c.fecha_fin IS NOT NULL AND c.fecha_fin >= CURRENT_DATE))"))
        ingresos_estimados = ingresos_estimados_rows.scalar()
        part_prom_rows = await db.execute(text("SELECT COALESCE(avg(cnt), 0) FROM (SELECT count(*) AS cnt FROM curso_participante GROUP BY curso_id) t"))
        participantes_promedio = part_prom_rows.scalar()
        tasa_acr_rows = await db.execute(text("SELECT COALESCE(sum(CASE WHEN estado_acreditacion = true THEN 1 ELSE 0 END)::float / NULLIF(count(*), 0) * 100, 0) FROM curso_participante"))
        tasa_acreditacion = tasa_acr_rows.scalar()
        mod_rows = await db.execute(text("SELECT c.modalidad, sum(p.monto) AS total, count(p.id) AS cantidad FROM cursos c LEFT JOIN curso_participante cp ON cp.curso_id = c.id LEFT JOIN pagos p ON p.curso_participante_id = cp.id AND p.estado_pago = 'completado' GROUP BY c.modalidad"))
        ingresos_por_modalidad_rows = mod_rows.fetchall()
        return {
            "total_clientes": int(total_clientes or 0),
            "clientes_por_categoria": [
                {"categoria": r[0], "count": int(r[1] or 0)} for r in categorias_data
            ],
            "total_cursos": int(total_cursos or 0),
            "total_capacitadores": int(total_capacitadores or 0),
            "total_participantes": int(total_participantes or 0),
            "total_certificados": int(total_certificados or 0),
            "ingresos_por_mes": [
                {"mes": r[0].strftime("%Y-%m"), "total": float(r[1] or 0), "cantidad": int(r[2] or 0)} for r in ingresos_data
            ],
            "validaciones_mes": {
                "total": int((validaciones_data or (0,0,0))[0] or 0),
                "exitosas": int((validaciones_data or (0,0,0))[1] or 0),
                "fallidas": int((validaciones_data or (0,0,0))[2] or 0),
                "tasa_exito": round(((validaciones_data or (0,0,0))[1] or 0) / max(((validaciones_data or (0,0,0))[0] or 1), 1) * 100, 2)
            },
            "certificados_proximos_vencer": int(proximos_vencer or 0),
            "ingresos_totales": float(ingresos_total or 0),
            "ingresos_pendientes": float(ingresos_pendientes or 0),
            "precios": {
                "promedio_base": float((precios or (0,))[0] or 0),
                "promedio_promocional": float((precios or (0,0))[1] or 0),
                "porcentaje_con_promocion": round((float((precios or (0,0,0,0))[2] or 0) / max(int((precios or (0,0,0,0))[3] or 1), 1)) * 100, 2),
            },
            "cursos_por_estado": [{"estado": r[0], "cantidad": int(r[1] or 0)} for r in cursos_estado],
            "pagos_por_estado": [{"estado": r[0], "cantidad": int(r[1] or 0), "total": float(r[2] or 0)} for r in pagos_estado],
            "pagos_conversion_30d": {
                "completados": int((pagos_30d or (0,0))[0] or 0),
                "fallidos": int((pagos_30d or (0,0))[1] or 0),
                "tasa_conversion": round((int((pagos_30d or (0,0))[0] or 0) / max(int(((pagos_30d or (0,0))[0] or 0)) + int(((pagos_30d or (0,0))[1] or 0)), 1)) * 100, 2)
            },
            "ingresos_estimados_proximos": float(ingresos_estimados or 0),
            "participantes_promedio_por_curso": float(participantes_promedio or 0),
            "tasa_acreditacion_global": float(tasa_acreditacion or 0),
            "ingresos_por_modalidad": [{"modalidad": r[0], "total": float(r[1] or 0), "cantidad": int(r[2] or 0)} for r in ingresos_por_modalidad_rows]
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo métricas del dashboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.get("/clientes")
async def get_admin_clientes(
    user_data: Dict[str, Any] = Depends(require_superadmin),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    categoria: Optional[str] = Query(None, regex="^(basico|premium|enterprise)$"),
    estado: Optional[str] = Query(None, regex="^(activo|suspendido|eliminado)$"),
    search: Optional[str] = Query(None, min_length=2),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Obtener lista de clientes para administrador"""
    try:
        # Usar esquema único aaces
        await db.execute(text("SET LOCAL search_path TO aaces"))
        where_clauses = []
        params: Dict[str, Any] = {}
        if categoria:
            where_clauses.append("categoria = :categoria")
            params["categoria"] = categoria
        if estado:
            where_clauses.append("estado = :estado")
            params["estado"] = estado
        if search:
            where_clauses.append("(nombre ILIKE :search OR correo ILIKE :search OR ciudad_base ILIKE :search)")
            params["search"] = f"%{search}%"
        if fecha_desde:
            where_clauses.append("(vigencia_hasta IS NULL OR vigencia_hasta >= :fecha_desde)")
            params["fecha_desde"] = fecha_desde
        if fecha_hasta:
            where_clauses.append("(vigencia_desde IS NULL OR vigencia_desde <= :fecha_hasta)")
            params["fecha_hasta"] = fecha_hasta

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        total_res = await db.execute(text(f"SELECT count(*) FROM clientes{where_sql}"), params)
        total_count = int(total_res.scalar() or 0)

        rows_res = await db.execute(text(
            f"SELECT id, nombre, correo, ciudad_base, categoria, estado, fecha_creacion, ultimo_acceso, vigencia_desde, vigencia_hasta FROM clientes {where_sql} ORDER BY fecha_creacion DESC OFFSET :skip LIMIT :limit"
        ), {**params, "skip": skip, "limit": limit})
        clientes_rows = rows_res.fetchall()

        # Obtener métricas por cliente
        clientes_data = []
        for r in clientes_rows:
            cid = str(r[0])
            # Cursos del cliente (SQL directo)
            cursos_res = await db.execute(text("SELECT count(*) FROM cursos WHERE cliente_id = :cid"), {"cid": cid})
            cursos_count = int(cursos_res.scalar() or 0)

            # Capacitadores del cliente (SQL directo)
            caps_res = await db.execute(text("SELECT count(*) FROM capacitadores WHERE cliente_id = :cid"), {"cid": cid})
            capacitadores_count = int(caps_res.scalar() or 0)

            # Ingresos totales del cliente (SQL directo)
            ing_res = await db.execute(text(
                """
                SELECT coalesce(sum(p.monto),0) 
                FROM pagos p 
                JOIN curso_participante cp ON cp.id = p.curso_participante_id 
                JOIN cursos c ON c.id = cp.curso_id 
                WHERE c.cliente_id = :cid AND p.estado_pago = 'completado'
                """
            ), {"cid": cid})
            ingresos = float(ing_res.scalar() or 0)

            vd = r[8]
            vh = r[9]
            today = datetime.utcnow().date()
            vigente = True
            if vd is not None and vh is not None:
                vigente = (vd <= today <= vh)
            elif vd is not None and vh is None:
                vigente = (vd <= today)
            else:
                vigente = False
            clientes_data.append({
                "id": cid,
                "nombre": r[1],
                "correo": r[2],
                "ciudad_base": r[3],
                "categoria": r[4],
                "estado": r[5],
                "fecha_creacion": r[6],
                "ultimo_acceso": r[7],
                "vigencia_desde": vd,
                "vigencia_hasta": vh,
                "vigente": vigente,
                "cursos_count": cursos_count,
                "capacitadores_count": capacitadores_count,
                "ingresos_totales": ingresos
            })
        
        return {
            "total": total_count,
            "page": skip // limit + 1,
            "per_page": limit,
            "total_pages": (total_count + limit - 1) // limit,
            "data": clientes_data
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo clientes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.put("/clientes/{cliente_id}/categoria")
async def update_cliente_categoria(
    cliente_id: str,
    categoria: str,
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Actualizar categoría de cliente (solo admin)"""
    try:
        if categoria not in ["basico", "premium", "enterprise"]:
            raise HTTPException(status_code=400, detail="Categoría inválida")
        res = await db.execute(text("SELECT categoria FROM clientes WHERE id = :id"), {"id": cliente_id})
        row = res.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        prev = row[0]
        await db.execute(text("UPDATE clientes SET categoria = :cat, fecha_actualizacion = now() WHERE id = :id"), {"cat": categoria, "id": cliente_id})
        await db.commit()
        audit_logger.log_user_action(user_id=user_data["sub"], action="update_cliente_categoria", resource="cliente", details={"cliente_id": cliente_id, "categoria_anterior": prev, "categoria_nueva": categoria})
        return {"message": f"Categoría actualizada a {categoria}", "cliente_id": cliente_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando categoría de cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/esquema/consolidar")
async def consolidar_esquema(
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    try:
        await db.execute(text("SET LOCAL search_path TO aaces"))
        tablas = [
            "clientes",
            "capacitadores",
            "participantes",
            "cursos",
            "curso_participante",
            "pagos"
        ]
        acciones = []
        for t in tablas:
            ex_a = await db.execute(text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'aaces' AND table_name = :t"), {"t": t})
            ex_p = await db.execute(text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"), {"t": t})
            has_a = ex_a.scalar() is not None
            has_p = ex_p.scalar() is not None
            if has_p:
                if not has_a:
                    await db.execute(text(f"CREATE TABLE aaces.{t} (LIKE public.{t} INCLUDING ALL)"))
                    acciones.append(f"create aaces.{t}")
                await db.execute(text(f"INSERT INTO aaces.{t} SELECT p.* FROM public.{t} p WHERE NOT EXISTS (SELECT 1 FROM aaces.{t} a WHERE a.id = p.id)"))
                acciones.append(f"copy public.{t} -> aaces.{t}")
                await db.execute(text(f"DROP TABLE IF EXISTS public.{t} CASCADE"))
                acciones.append(f"drop public.{t}")
        await db.commit()
        return {"consolidado": True, "acciones": acciones}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clientes/{cliente_id}/usage")
async def get_cliente_usage(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    """Obtener uso detallado de un cliente (cursos, participantes, almacenamiento)"""
    try:
        await db.execute(text("SET LOCAL search_path TO aaces"))
        info = await db.execute(
            text("SELECT id, nombre, correo, plan, cursos_max, descuento_pct FROM clientes WHERE id = :id"),
            {"id": cliente_id}
        )
        row = info.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        cursos_activos = await db.execute(
            text("SELECT count(*) FROM cursos WHERE cliente_id = :cid AND estado = 'activo'"),
            {"cid": cliente_id}
        )
        cursos_total = await db.execute(
            text("SELECT count(*) FROM cursos WHERE cliente_id = :cid"),
            {"cid": cliente_id}
        )
        participantes = await db.execute(
            text("SELECT count(DISTINCT cp.participante_id) FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid"),
            {"cid": cliente_id}
        )
        cert_count_res = await db.execute(
            text("SELECT count(*) FROM curso_participante cp JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid AND cp.estado_acreditacion = true"),
            {"cid": cliente_id}
        )
        cert_count = int(cert_count_res.scalar() or 0)
        constancias = await db.execute(
            text("SELECT count(*) FROM constancias_curso cc JOIN cursos c ON c.id = cc.curso_id WHERE c.cliente_id = :cid"),
            {"cid": cliente_id}
        )
        ingresos = await db.execute(
            text("SELECT coalesce(sum(p.monto), 0) FROM pagos p JOIN curso_participante cp ON cp.id = p.curso_participante_id JOIN cursos c ON c.id = cp.curso_id WHERE c.cliente_id = :cid AND p.estado_pago = 'completado'"),
            {"cid": cliente_id}
        )

        return {
            "cliente_id": row[0],
            "nombre": row[1],
            "correo": row[2],
            "plan": row[3],
            "cursos_max": int(row[4] or 10),
            "descuento_pct": int(row[5] or 0),
            "cursos_activos": int(cursos_activos.scalar() or 0),
            "cursos_total": int(cursos_total.scalar() or 0),
            "participantes_unicos": int(participantes.scalar() or 0),
            "certificados_emitidos": cert_count,
            "constancias_registradas": int(constancias.scalar() or 0),
            "ingresos_totales": float(ingresos.scalar() or 0),
            "almacenamiento_estimado_mb": round(cert_count * 0.2, 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo uso del cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@router.put("/clientes/{cliente_id}/password")
async def admin_update_cliente_password(
    cliente_id: str,
    payload: Dict[str, Any],
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Actualizar contraseña de un cliente (solo admin)"""
    try:
        new_password = payload.get("password")
        if not new_password or len(new_password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

        password_hash = security_service.hash_password(new_password)
        await db.execute(
            text(
                "UPDATE clientes SET password_hash = :ph, intentos_fallidos = 0, bloqueado_hasta = NULL, fecha_actualizacion = now() WHERE id = :id"
            ),
            {"ph": password_hash, "id": cliente_id}
        )
        await db.commit()

        audit_logger.log_user_action(
            user_id=user_data["sub"],
            action="admin_update_password",
            resource="cliente",
            details={"cliente_id": cliente_id}
        )
        return {"updated": 1}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando contraseña de cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/clientes/{cliente_id}/password/temp")
async def admin_generate_temp_password(
    cliente_id: str,
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Generar una contraseña temporal y marcar que debe cambiarse en el próximo acceso"""
    try:
        alphabet = string.ascii_letters + string.digits
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        password_hash = security_service.hash_password(temp_password)
        await db.execute(
            text(
                "UPDATE clientes SET password_hash = :ph, must_change_password = true, intentos_fallidos = 0, bloqueado_hasta = NULL, fecha_actualizacion = now() WHERE id = :id"
            ),
            {"ph": password_hash, "id": cliente_id}
        )
        await db.commit()
        audit_logger.log_user_action(user_id=user_data["sub"], action="admin_generate_temp_password", resource="cliente", details={"cliente_id": cliente_id})
        return {"temp_password": temp_password}
    except Exception as e:
        logger.error(f"Error generando contraseña temporal: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
@router.get("/auditoria")
async def get_auditoria_logs(
    user_data: Dict[str, Any] = Depends(require_superadmin),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tabla: Optional[str] = Query(None),
    operacion: Optional[str] = Query(None, regex="^(INSERT|UPDATE|DELETE)$"),
    usuario_id: Optional[str] = Query(None),
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Obtener logs de auditoría (solo admin)"""
    try:
        query = select(AuditoriaCambio)
        
        # Filtros
        if tabla:
            query = query.where(AuditoriaCambio.tabla_nombre == tabla)
        if operacion:
            query = query.where(AuditoriaCambio.operacion == operacion)
        if usuario_id:
            query = query.where(AuditoriaCambio.usuario_id == usuario_id)
        if fecha_desde:
            query = query.where(AuditoriaCambio.fecha_cambio >= fecha_desde)
        if fecha_hasta:
            query = query.where(AuditoriaCambio.fecha_cambio <= fecha_hasta)
        
        # Total count
        total_count = await db.scalar(select(func.count()).select_from(query.subquery()))
        
        # Paginación y orden
        query = query.order_by(AuditoriaCambio.fecha_cambio.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        logs = result.scalars().all()
        
        return {
            "total": total_count,
            "page": skip // limit + 1,
            "per_page": limit,
            "total_pages": (total_count + limit - 1) // limit,
            "data": [
                {
                    "id": log.id,
                    "tabla_nombre": log.tabla_nombre,
                    "operacion": log.operacion,
                    "usuario_id": log.usuario_id,
                    "fecha_cambio": log.fecha_cambio,
                    "datos_anteriores": log.datos_anteriores,
                    "datos_nuevos": log.datos_nuevos,
                    "ip_origen": log.ip_origen,
                    "user_agent": log.user_agent
                }
                for log in logs
            ]
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo logs de auditoría: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.get("/reports/monthly")
async def get_monthly_report(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2020),
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Obtener reporte mensual detallado"""
    try:
        fecha_inicio = datetime(anio, mes, 1)
        if mes == 12:
            fecha_fin = datetime(anio + 1, 1, 1)
        else:
            fecha_fin = datetime(anio, mes + 1, 1)
        
        # Clientes nuevos del mes
        clientes_nuevos = await db.scalar(
            select(func.count(Cliente.id))
            .where(
                and_(
                    Cliente.fecha_creacion >= fecha_inicio,
                    Cliente.fecha_creacion < fecha_fin
                )
            )
        )
        
        # Cursos del mes
        cursos_mes = await db.execute(
            select(
                func.count(Curso.id).label("total"),
                func.sum(Curso.costo_total).label("valor_total")
            )
            .where(
                and_(
                    Curso.fecha_creacion >= fecha_inicio,
                    Curso.fecha_creacion < fecha_fin
                )
            )
        )
        cursos_data = cursos_mes.one()
        
        # Ingresos del mes
        ingresos_mes = await db.execute(
            select(
                func.sum(Pago.monto).label("total"),
                func.count(Pago.id).label("cantidad"),
                func.avg(Pago.monto).label("promedio")
            )
            .where(
                and_(
                    Pago.estado_pago == "completado",
                    Pago.fecha_pago >= fecha_inicio,
                    Pago.fecha_pago < fecha_fin
                )
            )
        )
        ingresos_data = ingresos_mes.one()
        
        # Top clientes por ingresos
        top_clientes = await db.execute(
            select(
                Cliente.nombre,
                Cliente.correo,
                func.sum(Pago.monto).label("total_ingresos"),
                func.count(Pago.id).label("cantidad_pagos")
            )
            .join(Curso, Cliente.id == Curso.cliente_id)
            .join(CursoParticipante, Curso.id == CursoParticipante.curso_id)
            .join(Pago, CursoParticipante.id == Pago.curso_participante_id)
            .where(
                and_(
                    Pago.estado_pago == "completado",
                    Pago.fecha_pago >= fecha_inicio,
                    Pago.fecha_pago < fecha_fin
                )
            )
            .group_by(Cliente.id, Cliente.nombre, Cliente.correo)
            .order_by(func.sum(Pago.monto).desc())
            .limit(10)
        )
        top_clientes_data = top_clientes.all()
        
        return {
            "periodo": f"{anio}-{str(mes).zfill(2)}",
            "clientes_nuevos": clientes_nuevos or 0,
            "cursos_nuevos": cursos_data.total or 0,
            "valor_cursos": float(cursos_data.valor_total or 0),
            "ingresos_totales": float(ingresos_data.total or 0),
            "cantidad_pagos": ingresos_data.cantidad or 0,
            "promedio_pago": float(ingresos_data.promedio or 0),
            "top_clientes": [
                {
                    "nombre": nombre,
                    "correo": correo,
                    "total_ingresos": float(total_ingresos),
                    "cantidad_pagos": cantidad_pagos
                }
                for nombre, correo, total_ingresos, cantidad_pagos in top_clientes_data
            ]
        }
        
    except Exception as e:
        logger.error(f"Error generando reporte mensual: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.get("/dashboard/ciudad")
async def get_stats_por_ciudad(
    periodo: str = Query("mes", regex="^(semana|mes|anio)$"),
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        tabla = "mv_finanzas_ciudad_mes" if periodo == "mes" else ("mv_finanzas_ciudad_semana" if periodo == "semana" else "mv_finanzas_ciudad_anio")
        await db.execute(text(f"REFRESH MATERIALIZED VIEW aaces.{tabla}"))
        q = f"SELECT ciudad, periodo, total_monto, total_pagado, cantidad FROM aaces.{tabla} ORDER BY periodo, ciudad"
        data = await db.execute(text(q))
        rows = data.fetchall()
        return {
            "periodo": periodo,
            "data": [
                {
                    "ciudad": r[0],
                    "periodo": r[1].strftime("%Y-%m-%d"),
                    "total_monto": float(r[2] or 0),
                    "total_pagado": float(r[3] or 0),
                    "cantidad": int(r[4] or 0),
                } for r in rows
            ]
        }
    except Exception as e:
        logger.error(f"Error en métricas por ciudad: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/clientes")
async def create_admin_cliente(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        nombre = payload.get("nombre")
        correo = payload.get("correo")
        categoria = payload.get("categoria", "basico")
        ciudad_base = payload.get("ciudad_base")
        estado = payload.get("estado", "activo")
        password = payload.get("password", "Temporal123!")
        from app.services.security import security_service
        pwd_hash = security_service.hash_password(password)
        q = text(
            """
            INSERT INTO clientes (id, nombre, correo, password_hash, categoria, estado, ciudad_base, fecha_creacion, acepta_terminos, vigencia_desde, vigencia_hasta)
            VALUES (gen_random_uuid(), :nombre, :correo, :ph, :cat, :est, :ciudad, now(), true, to_date(:vd, 'YYYY-MM-DD'), to_date(:vh, 'YYYY-MM-DD'))
            RETURNING id
            """
        )
        res = await db.execute(q, {"nombre": nombre, "correo": correo, "ph": pwd_hash, "cat": categoria, "est": estado, "ciudad": ciudad_base, "vd": payload.get("vigencia_desde"), "vh": payload.get("vigencia_hasta")})
        new_id = res.scalar()
        await db.commit()
        return {"id": str(new_id)}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creando cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/clientes/{cliente_id}")
async def update_admin_cliente(
    cliente_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        allowed = ["nombre", "correo", "categoria", "estado", "ciudad_base", "vigencia_desde", "vigencia_hasta", "plan", "cursos_max", "descuento_pct"]
        sets = []
        params = {"id": cliente_id}
        for k in allowed:
            if k in payload:
                if k in ["vigencia_desde", "vigencia_hasta"]:
                    sets.append(f"{k} = to_date(:{k}, 'YYYY-MM-DD')")
                else:
                    sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        if not sets:
            return {"updated": 0}
        q = text(f"UPDATE clientes SET {', '.join(sets)}, fecha_actualizacion = now() WHERE id = :id")
        await db.execute(q, params)
        await db.commit()
        return {"updated": 1}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error actualizando cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.delete("/clientes/{cliente_id}")
async def delete_admin_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        await db.execute(text("UPDATE clientes SET estado = 'eliminado', fecha_eliminacion = now() WHERE id = :id"), {"id": cliente_id})
        await db.commit()
        return {"deleted": 1}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error eliminando cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/clientes/enforce-vigencia")
async def enforce_vigencia(
    ids: Optional[List[str]] = None,
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        if ids and len(ids) > 0:
            tmp_ids = ",".join([f"'{i}'" for i in ids])
            where_ids = f"id IN ({tmp_ids})"
        else:
            where_ids = "estado <> 'eliminado'"
        q = text(
            f"""
            UPDATE clientes
            SET estado = CASE
                WHEN vigencia_desde IS NOT NULL AND vigencia_hasta IS NOT NULL AND CURRENT_DATE BETWEEN vigencia_desde AND vigencia_hasta THEN 'activo'
                WHEN vigencia_desde IS NOT NULL AND vigencia_hasta IS NULL AND CURRENT_DATE >= vigencia_desde THEN 'activo'
                ELSE 'suspendido'
            END,
            fecha_actualizacion = now()
            WHERE {where_ids}
            """
        )
        await db.execute(q)
        await db.commit()
        return {"enforced": True}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error aplicando vigencias: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/clientes/bulk-estado")
async def bulk_update_estado(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        ids = payload.get("ids", [])
        estado = payload.get("estado")
        if estado not in ["activo", "suspendido", "eliminado"]:
            raise HTTPException(status_code=400, detail="Estado inválido")
        if not ids:
            return {"updated": 0}
        tmp_ids = ",".join([f"'{i}'" for i in ids])
        q = text(f"UPDATE clientes SET estado = :estado, fecha_actualizacion = now() WHERE id IN ({tmp_ids})")
        await db.execute(q, {"estado": estado})
        await db.commit()
        return {"updated": len(ids)}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error en bulk estado: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/cursos/{curso_id}")
async def admin_update_curso(
    curso_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        allowed = ["ciudad", "empresa_contratante", "fecha_inicio", "fecha_fin", "estado"]
        sets = []
        params = {"id": curso_id}
        for k in allowed:
            if k in payload:
                sets.append(f"{k} = :{k}")
                params[k] = payload[k]
        if not sets:
            return {"updated": 0}
        q = text(f"UPDATE cursos SET {', '.join(sets)} WHERE id = :id")
        await db.execute(q, params)
        await db.commit()
        return {"updated": 1}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error actualizando curso: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.put("/curso-participante/{cp_id}/precio")
async def update_precio_participante(
    cp_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        q_a = text("UPDATE aaces.curso_participante SET costo_asignado = :costo, descuento = :descuento WHERE id = :id")
        await db.execute(q_a, {"costo": payload.get("costo_asignado", 0), "descuento": payload.get("descuento", 0), "id": cp_id})
        q = text("UPDATE curso_participante SET costo_asignado = :costo, descuento = :descuento WHERE id = :id")
        await db.execute(q, {"costo": payload.get("costo_asignado", 0), "descuento": payload.get("descuento", 0), "id": cp_id})
        await db.commit()
        return {"updated": 1}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error actualizando precio: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/clientes/{cliente_id}/cursos")
async def get_cursos_por_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        q = text("SELECT id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, estado, empresa_contratante FROM cursos WHERE cliente_id = :cid ORDER BY fecha_inicio DESC")
        res = await db.execute(q, {"cid": cliente_id})
        rows = res.fetchall()
        data = [
            {"id": r[0], "codigo_curso": r[1], "nombre": r[2], "ciudad": r[3], "fecha_inicio": r[4], "fecha_fin": r[5], "estado": r[6], "empresa_contratante": r[7]}
            for r in rows
        ]
        return {"data": data}
    except Exception as e:
        logger.error(f"Error obteniendo cursos por cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/clientes/{cliente_id}/participantes")
async def get_participantes_por_cliente(
    cliente_id: str,
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        res = await db.execute(
            select(
                CursoParticipante.participante_id,
                func.max(Participante.nombre),
                func.max(Participante.apellido),
                func.max(Participante.nombres),
                func.max(Participante.apellido_paterno),
                func.max(Participante.apellido_materno),
                func.max(Participante.correo),
                func.max(Participante.ciudad_origen),
                func.max(Participante.nivel_educacion)
            )
            .join(Curso, Curso.id == CursoParticipante.curso_id)
            .join(Participante, Participante.id == CursoParticipante.participante_id)
            .where(Curso.cliente_id == cliente_id)
            .group_by(CursoParticipante.participante_id)
        )
        rows = res.all()
        participantes = [
            {
                "id": r[0], "nombre": r[1], "apellido": r[2], "nombres": r[3], "apellido_paterno": r[4], "apellido_materno": r[5], "correo": r[6], "ciudad": r[7], "profesion": r[8]
            } for r in rows
        ]
        return {"data": participantes}
    except Exception as e:
        logger.error(f"Error obteniendo participantes por cliente: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/mantenimiento/fk/pagos-cascade")
async def ensure_pagos_fk_cascade(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        await db.execute(text("SET LOCAL search_path TO aaces"))
        await db.execute(text("ALTER TABLE IF EXISTS pagos DROP CONSTRAINT IF EXISTS curso_participante_id_fkey"))
        await db.execute(text("ALTER TABLE IF EXISTS pagos DROP CONSTRAINT IF EXISTS pagos_curso_participante_id_fkey"))
        await db.execute(text("ALTER TABLE IF EXISTS pagos ADD CONSTRAINT pagos_curso_participante_id_fkey FOREIGN KEY (curso_participante_id) REFERENCES curso_participante(id) ON DELETE CASCADE"))
        await db.commit()
        return {"updated_count": 1}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error asegurando ON DELETE CASCADE en pagos: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.post("/mantenimiento/drop-curso-participante-underscore")
async def drop_curso_participante_underscore(
    db: AsyncSession = Depends(get_db),
    user_data: Dict[str, Any] = Depends(require_superadmin)
):
    try:
        chk = await db.execute(text("SELECT to_regclass('curso_participante_') IS NOT NULL"))
        if chk.scalar():
            await db.execute(text("DROP TABLE IF EXISTS curso_participante_ CASCADE"))
            await db.commit()
            return {"dropped": True}
        return {"dropped": False}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error eliminando tabla curso_participante_: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


# =============================================================================
# ORGANIZACIONES (Nuevo esquema SaaS)
# =============================================================================

@router.get("/organizaciones")
async def listar_organizaciones(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    estatus: Optional[str] = Query(None, regex="^(pendiente|activa|suspendida|cancelada)$"),
    search: Optional[str] = Query(None, min_length=2),
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    where = []
    params: Dict[str, Any] = {}

    if estatus:
        where.append("o.estatus = :estatus")
        params["estatus"] = estatus
    if search:
        where.append(
            "(o.razon_social ILIKE :s OR o.rfc ILIKE :s OR o.nombre_comercial ILIKE :s OR "
            "o.email_contacto ILIKE :s)"
        )
        params["s"] = f"%{search}%"

    where_sql = " WHERE " + " AND ".join(where) if where else ""

    total_res = await db.execute(
        text(f"SELECT count(*) FROM aaces.organizaciones o{where_sql}"),
        params
    )
    total = int(total_res.scalar() or 0)

    offset = (page - 1) * per_page
    rows_res = await db.execute(
        text(f"""
            SELECT o.id, o.rfc, o.razon_social, o.nombre_comercial, o.email_contacto,
                   o.estado, o.ciudad, o.estatus, o.fecha_creacion, o.fecha_activacion,
                   o.notas_admin,
                   (SELECT count(*) FROM aaces.usuarios WHERE organizacion_id = o.id) as num_usuarios,
                   (SELECT count(*) FROM aaces.suscripciones WHERE organizacion_id = o.id AND estatus = 'activa') as suscripciones_activas
            FROM aaces.organizaciones o{where_sql}
            ORDER BY
                CASE WHEN o.estatus = 'pendiente' THEN 0 ELSE 1 END,
                o.fecha_creacion DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": per_page, "offset": offset}
    )
    rows = rows_res.fetchall()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page if total > 0 else 1,
        "data": [
            {
                "id": str(r[0]), "rfc": r[1], "razon_social": r[2],
                "nombre_comercial": r[3], "email_contacto": r[4],
                "estado": r[5], "ciudad": r[6], "estatus": r[7],
                "fecha_creacion": r[8].isoformat() if r[8] else None,
                "fecha_activacion": r[9].isoformat() if r[9] else None,
                "notas_admin": r[10],
                "num_usuarios": int(r[11] or 0),
                "suscripciones_activas": int(r[12] or 0),
            }
            for r in rows
        ]
    }


@router.get("/organizaciones/{org_id}")
async def detalle_organizacion(
    org_id: str,
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("""
            SELECT o.id, o.rfc, o.razon_social, o.nombre_comercial, o.email_contacto,
                   o.telefono, o.estado, o.ciudad, o.direccion, o.estatus,
                   o.fecha_creacion, o.fecha_activacion, o.notas_admin
            FROM aaces.organizaciones o WHERE o.id = :id
        """),
        {"id": org_id}
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    # Get usuarios
    usuarios_res = await db.execute(
        text("""
            SELECT id, nombre, correo, rol, activo, ultimo_acceso, fecha_creacion
            FROM aaces.usuarios WHERE organizacion_id = :org_id ORDER BY fecha_creacion
        """),
        {"org_id": org_id}
    )
    usuarios = [
        {
            "id": str(u[0]), "nombre": u[1], "correo": u[2],
            "rol": u[3], "activo": u[4],
            "ultimo_acceso": u[5].isoformat() if u[5] else None,
            "fecha_creacion": u[6].isoformat() if u[6] else None,
        }
        for u in usuarios_res.fetchall()
    ]

    # Get suscripciones
    susc_res = await db.execute(
        text("""
            SELECT s.id, s.plan_id, p.codigo, p.nombre, s.estatus,
                   s.fecha_inicio, s.fecha_fin, s.cursos_max, s.usuarios_max,
                   s.constancias_max, s.fecha_creacion,
                   COALESCE(s.cursos_max, p.cursos_max) as cursos_efectivo,
                   COALESCE(s.usuarios_max, p.usuarios_max) as usuarios_efectivo,
                   COALESCE(s.constancias_max, p.constancias_max) as constancias_efectivo
            FROM aaces.suscripciones s
            JOIN aaces.planes p ON p.id = s.plan_id
            WHERE s.organizacion_id = :org_id
            ORDER BY s.fecha_creacion DESC
        """),
        {"org_id": org_id}
    )
    suscripciones = [
        {
            "id": str(s[0]), "plan_id": str(s[1]), "plan_codigo": s[2],
            "plan_nombre": s[3], "estatus": s[4],
            "fecha_inicio": s[5].isoformat() if s[5] else None,
            "fecha_fin": s[6].isoformat() if s[6] else None,
            "cursos_max": int(s[7] or s[11] or 0),
            "usuarios_max": int(s[8] or s[12] or 0),
            "constancias_max": int(s[9] or s[13] or 0),
            "fecha_creacion": s[10].isoformat() if s[10] else None,
        }
        for s in susc_res.fetchall()
    ]

    return {
        "id": str(row[0]), "rfc": row[1], "razon_social": row[2],
        "nombre_comercial": row[3], "email_contacto": row[4],
        "telefono": row[5], "estado": row[6], "ciudad": row[7],
        "direccion": row[8], "estatus": row[9],
        "fecha_creacion": row[10].isoformat() if row[10] else None,
        "fecha_activacion": row[11].isoformat() if row[11] else None,
        "notas_admin": row[12],
        "usuarios": usuarios,
        "suscripciones": suscripciones,
    }


@router.put("/organizaciones/{org_id}/activar")
async def activar_organizacion(
    org_id: str,
    payload: Dict[str, Any],
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT id, estatus FROM aaces.organizaciones WHERE id = :id"),
        {"id": org_id}
    )
    org = res.fetchone()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    vigencia_desde = payload.get("vigencia_desde")
    vigencia_hasta = payload.get("vigencia_hasta")
    if isinstance(vigencia_desde, str):
        vigencia_desde = date.fromisoformat(vigencia_desde)
    if isinstance(vigencia_hasta, str):
        vigencia_hasta = date.fromisoformat(vigencia_hasta)
    plan_id = payload.get("plan_id")
    cursos_max = payload.get("cursos_max")
    usuarios_max = payload.get("usuarios_max")
    constancias_max = payload.get("constancias_max")

    await db.execute(
        text("""
            UPDATE aaces.organizaciones
            SET estatus = 'activa', fecha_activacion = now(), notas_admin = :notas
            WHERE id = :id
        """),
        {"id": org_id, "notas": payload.get("notas_admin")}
    )

    if plan_id:
        susc_res = await db.execute(
            text("""
                UPDATE aaces.suscripciones
                SET estatus = 'activa', plan_id = :plan_id,
                    fecha_inicio = COALESCE(:fecha_inicio, CURRENT_DATE),
                    fecha_fin = :fecha_fin,
                    cursos_max = :cursos_max, usuarios_max = :usuarios_max,
                    constancias_max = :constancias_max,
                    activada_por = :admin_id
                WHERE organizacion_id = :org_id AND estatus = 'pendiente'
                RETURNING id
            """),
            {
                "org_id": org_id, "plan_id": plan_id,
                "fecha_inicio": vigencia_desde, "fecha_fin": vigencia_hasta,
                "cursos_max": cursos_max, "usuarios_max": usuarios_max,
                "constancias_max": constancias_max,
                "admin_id": user_data["sub"],
            }
        )
        if susc_res.rowcount == 0:
            # No pending subscription, create one
            await db.execute(
                text("""
                    INSERT INTO aaces.suscripciones (organizacion_id, plan_id, estatus, fecha_inicio, fecha_fin, cursos_max, usuarios_max, constancias_max, activada_por)
                    VALUES (:org_id, :plan_id, 'activa', COALESCE(:fecha_inicio, CURRENT_DATE), :fecha_fin, :cursos_max, :usuarios_max, :constancias_max, :admin_id)
                """),
                {
                    "org_id": org_id, "plan_id": plan_id,
                    "fecha_inicio": vigencia_desde, "fecha_fin": vigencia_hasta,
                    "cursos_max": cursos_max, "usuarios_max": usuarios_max,
                    "constancias_max": constancias_max,
                    "admin_id": user_data["sub"],
                }
            )
    else:
        # Activate without changing plan
        await db.execute(
            text("""
                UPDATE aaces.suscripciones
                SET estatus = 'activa',
                    fecha_inicio = COALESCE(:fecha_inicio, CURRENT_DATE),
                    fecha_fin = :fecha_fin,
                    cursos_max = COALESCE(:cursos_max, cursos_max),
                    usuarios_max = COALESCE(:usuarios_max, usuarios_max),
                    constancias_max = COALESCE(:constancias_max, constancias_max),
                    activada_por = :admin_id
                WHERE organizacion_id = :org_id AND estatus = 'pendiente'
            """),
            {
                "org_id": org_id,
                "fecha_inicio": vigencia_desde, "fecha_fin": vigencia_hasta,
                "cursos_max": cursos_max, "usuarios_max": usuarios_max,
                "constancias_max": constancias_max,
                "admin_id": user_data["sub"],
            }
        )

    # Bridge legacy: crear registro en clientes para compatibilidad con CRUD legacy
    cliente_existente = await db.execute(
        text("SELECT id FROM aaces.clientes WHERE organizacion_id = :org_id LIMIT 1"),
        {"org_id": org_id}
    )
    if not cliente_existente.fetchone():
        admin_user = await db.execute(
            text("""
                SELECT nombre, correo, password_hash
                FROM aaces.usuarios
                WHERE organizacion_id = :org_id AND rol = 'admin'
                LIMIT 1
            """),
            {"org_id": org_id}
        )
        admin = admin_user.fetchone()
        if admin:
            await db.execute(
                text("""
                    INSERT INTO aaces.clientes
                        (nombre, correo, password_hash, plan, cursos_max,
                         cursos_creados, descuento_pct, categoria, estado,
                         organizacion_id)
                    VALUES
                        (:nombre, :correo, :ph, :plan, :cursos_max,
                         0, 0, 'basico', 'activo',
                         :org_id)
                """),
                {
                    "nombre": admin[0],
                    "correo": admin[1],
                    "ph": admin[2],
                    "plan": "trial" if not plan_id else "empresarial",
                    "cursos_max": cursos_max or 50,
                    "org_id": org_id,
                }
            )

    await db.commit()

    audit_logger.log_user_action(
        user_id=user_data["sub"],
        action="activar_organizacion",
        resource="organizacion",
        details={"org_id": org_id, "plan_id": plan_id}
    )

    return {"success": True, "message": "Organización activada exitosamente"}


@router.put("/organizaciones/{org_id}/suspender")
async def suspender_organizacion(
    org_id: str,
    payload: Dict[str, Any],
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT id FROM aaces.organizaciones WHERE id = :id"),
        {"id": org_id}
    )
    if not res.fetchone():
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    await db.execute(
        text("UPDATE aaces.organizaciones SET estatus = 'suspendida', notas_admin = :notas WHERE id = :id"),
        {"id": org_id, "notas": payload.get("notas_admin")}
    )
    await db.execute(
        text("UPDATE aaces.suscripciones SET estatus = 'expirada' WHERE organizacion_id = :org_id AND estatus = 'activa'"),
        {"org_id": org_id}
    )
    await db.commit()

    return {"success": True, "message": "Organización suspendida"}


@router.put("/organizaciones/{org_id}/suscripcion")
async def actualizar_suscripcion(
    org_id: str,
    payload: Dict[str, Any],
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    res = await db.execute(
        text("SELECT id FROM aaces.organizaciones WHERE id = :id"),
        {"id": org_id}
    )
    if not res.fetchone():
        raise HTTPException(status_code=404, detail="Organización no encontrada")

    plan_id = payload.get("plan_id")
    fecha_inicio = payload.get("fecha_inicio")
    fecha_fin = payload.get("fecha_fin")
    cursos_max = payload.get("cursos_max")
    usuarios_max = payload.get("usuarios_max")
    constancias_max = payload.get("constancias_max")
    estatus = payload.get("estatus", "activa")

    updates = ["fecha_actualizacion = now()"]
    params: Dict[str, Any] = {"org_id": org_id}
    if plan_id:
        updates.append("plan_id = :plan_id")
        params["plan_id"] = plan_id
    if fecha_inicio:
        updates.append("fecha_inicio = :fecha_inicio")
        params["fecha_inicio"] = fecha_inicio
    if fecha_fin:
        updates.append("fecha_fin = :fecha_fin")
        params["fecha_fin"] = fecha_fin
    if cursos_max is not None:
        updates.append("cursos_max = :cursos_max")
        params["cursos_max"] = int(cursos_max)
    if usuarios_max is not None:
        updates.append("usuarios_max = :usuarios_max")
        params["usuarios_max"] = int(usuarios_max)
    if constancias_max is not None:
        updates.append("constancias_max = :constancias_max")
        params["constancias_max"] = int(constancias_max)
    if estatus:
        updates.append("estatus = :estatus")
        params["estatus"] = estatus

    await db.execute(
        text(f"UPDATE aaces.suscripciones SET {', '.join(updates)} WHERE organizacion_id = :org_id AND estatus IN ('activa', 'pendiente')"),
        params
    )
    await db.commit()

    return {"success": True, "message": "Suscripción actualizada"}


@router.get("/registro-intentos")
async def listar_registro_intentos(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    resultado: Optional[str] = Query(None, regex="^(exito|duplicado|bloqueado|error)$"),
    user_data: Dict[str, Any] = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(text("SET LOCAL search_path TO aaces"))
    where = []
    params: Dict[str, Any] = {}
    if resultado:
        where.append("resultado = :resultado")
        params["resultado"] = resultado

    where_sql = " WHERE " + " AND ".join(where) if where else ""

    total_res = await db.execute(
        text(f"SELECT count(*) FROM aaces.registro_intentos{where_sql}"),
        params
    )
    total = int(total_res.scalar() or 0)

    offset = (page - 1) * per_page
    rows_res = await db.execute(
        text(f"""
            SELECT id, rfc, correo, ip_origen, user_agent, resultado, detalle, fecha
            FROM aaces.registro_intentos{where_sql}
            ORDER BY fecha DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": per_page, "offset": offset}
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "data": [
            {
                "id": str(r[0]), "rfc": r[1], "correo": r[2],
                "ip_origen": r[3], "user_agent": r[4],
                "resultado": r[5], "detalle": r[6],
                "fecha": r[7].isoformat() if r[7] else None,
            }
            for r in rows_res.fetchall()
        ]
    }
