from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from app.db.errors import is_undefined_table
from app.core.tenant import organization_id
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class DashboardService:
    async def get_resumen(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> dict:
        org_id = organization_id(user_data)
        if not org_id:
            return {
                "kpis": {
                    "cursos_activos": 0, "participantes": 0,
                    "constancias_mes": 0, "por_vencer": 0,
                    "alertas_criticas": 0,
                }
            }
        cid_list = f"'{org_id}'"

        result = await db.execute(
            text(f"""
                SELECT
                    (SELECT count(*) FROM aaces.cursos
                     WHERE cliente_id IN ({cid_list})
                       AND estado IN ('activo', 'en_espera')) AS cursos_activos,
                    (SELECT count(DISTINCT cp.participante_id)
                     FROM aaces.curso_participante cp
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list})) AS participantes,
                    (SELECT count(*)
                     FROM aaces.curso_participante cp
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list})
                       AND cp.estado_acreditacion = true
                       AND cp.fecha_emision_certificado >= date_trunc('month', CURRENT_DATE)) AS constancias_mes,
                    (SELECT count(*)
                     FROM aaces.curso_participante cp
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list})
                       AND cp.estado_acreditacion = true
                       AND cp.fecha_expiracion BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS constancias_por_vencer
            """)
        )
        row = result.fetchone()
        alertas_count = 0
        if row:
            if int(row[3] or 0) > 0:
                alertas_count += 1
            sin_instructor = await db.execute(
                text(f"""
                    SELECT count(*) FROM aaces.cursos
                    WHERE cliente_id IN ({cid_list}) AND estado IN ('activo', 'en_espera')
                      AND (capacitador_id IS NULL OR capacitador_id = '00000000-0000-0000-0000-000000000000')
                """)
            )
            if int(sin_instructor.scalar() or 0) > 0:
                alertas_count += 1
            pendientes = await db.execute(
                text(f"""
                    SELECT count(*) FROM aaces.curso_participante cp
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = false
                """)
            )
            if int(pendientes.scalar() or 0) > 0:
                alertas_count += 1
        pendientes = {"acreditar": 0, "emitir": 0, "vencer": 0}
        if row:
            pendientes_p = await db.execute(
                text(f"""
                    SELECT count(*) FROM aaces.curso_participante cp
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = false
                """)
            )
            pendientes["acreditar"] = int(pendientes_p.scalar() or 0)

            acreditados = await db.execute(
                text(f"""
                    SELECT count(*) FROM aaces.curso_participante cp
                    JOIN aaces.cursos c ON c.id = cp.curso_id
                    WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = true
                """)
            )
            total_acreditados = int(acreditados.scalar() or 0)
            try:
                con_constancia = await db.execute(
                    text(f"""
                        SELECT count(DISTINCT cp.id) FROM aaces.documentos_emitidos d
                        JOIN aaces.curso_participante cp ON cp.codigo_validacion = CAST(d.codigo_validacion AS varchar)
                        JOIN aaces.cursos c ON c.id = cp.curso_id
                        WHERE c.cliente_id IN ({cid_list}) AND d.tipo_documento = 'CONSTANCIA'
                    """)
                )
                emitidas = int(con_constancia.scalar() or 0)
            except ProgrammingError as e:
                if is_undefined_table(e):
                    emitidas = 0
                else:
                    raise
            pendientes["emitir"] = total_acreditados - emitidas
            if pendientes["emitir"] < 0:
                pendientes["emitir"] = 0

            pendientes["vencer"] = int(row[3] or 0) if row else 0

        return {
            "kpis": {
                "cursos_activos": int(row[0] or 0) if row else 0,
                "participantes": int(row[1] or 0) if row else 0,
                "constancias_mes": int(row[2] or 0) if row else 0,
                "por_vencer": int(row[3] or 0) if row else 0,
                "alertas_criticas": alertas_count,
            },
            "pendientes": pendientes,
        }

    async def get_onboarding(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> dict:
        org_id = organization_id(user_data)
        if not org_id:
            return {"tiene_cursos": False, "tiene_participantes": False, "tiene_constancias": False, "progreso": 0}
        cid_list = f"'{org_id}'"

        result = await db.execute(
            text(f"""
                SELECT
                    (SELECT count(*) FROM aaces.cursos WHERE cliente_id IN ({cid_list})) AS total_cursos,
                    (SELECT count(DISTINCT cp.participante_id)
                     FROM aaces.curso_participante cp
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list})) AS total_participantes,
                    (SELECT count(*)
                     FROM aaces.curso_participante cp
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list})
                       AND cp.estado_acreditacion = true) AS total_constancias
            """)
        )
        row = result.fetchone()
        tiene_cursos = int(row[0] or 0) > 0 if row else False
        tiene_participantes = int(row[1] or 0) > 0 if row else False
        tiene_constancias = int(row[2] or 0) > 0 if row else False

        steps = [tiene_cursos, tiene_participantes, tiene_constancias]
        completados = sum(1 for s in steps if s)
        progreso = round((completados / len(steps)) * 100)

        return {
            "tiene_cursos": tiene_cursos,
            "tiene_participantes": tiene_participantes,
            "tiene_constancias": tiene_constancias,
            "progreso": progreso,
        }

    async def get_alertas(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> list[dict]:
        org_id = organization_id(user_data)
        if not org_id:
            return []
        cid_list = f"'{org_id}'"

        alertas = []
        vencimiento = await db.execute(
            text(f"""
                SELECT count(*) FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                WHERE c.cliente_id IN ({cid_list})
                  AND cp.estado_acreditacion = true
                  AND cp.fecha_expiracion BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
            """)
        )
        cant = int(vencimiento.scalar() or 0)
        if cant > 0:
            alertas.append({"tipo": "constancias_por_vencer", "cantidad": cant, "prioridad": "alta"})

        sin_inst = await db.execute(
            text(f"""
                SELECT count(*) FROM aaces.cursos
                WHERE cliente_id IN ({cid_list}) AND estado IN ('activo', 'en_espera')
                  AND (capacitador_id IS NULL OR capacitador_id = '00000000-0000-0000-0000-000000000000')
            """)
        )
        cant = int(sin_inst.scalar() or 0)
        if cant > 0:
            alertas.append({"tipo": "cursos_sin_instructor", "cantidad": cant, "prioridad": "media"})

        pend = await db.execute(
            text(f"""
                SELECT count(*) FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = false
            """)
        )
        cant = int(pend.scalar() or 0)
        if cant > 0:
            alertas.append({"tipo": "participantes_sin_constancia", "cantidad": cant, "prioridad": "alta"})

        sin_emp = await db.execute(
            text(f"""
                SELECT count(*) FROM aaces.cursos
                WHERE cliente_id IN ({cid_list}) AND estado IN ('activo', 'en_espera')
                  AND (empresa_contratante IS NULL OR empresa_contratante = '')
            """)
        )
        cant = int(sin_emp.scalar() or 0)
        if cant > 0:
            alertas.append({"tipo": "cursos_sin_empresa", "cantidad": cant, "prioridad": "baja"})

        return alertas

    async def get_agenda(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> list[dict]:
        org_id = organization_id(user_data)
        if not org_id:
            return []
        cid_list = f"'{org_id}'"
        result = await db.execute(
            text(f"""
                SELECT c.id, c.nombre, c.fecha_inicio, c.fecha_fin,
                       c.empresa_contratante, c.ciudad, c.modalidad,
                       (SELECT count(*) FROM aaces.curso_participante cp WHERE cp.curso_id = c.id) AS participantes_count
                FROM aaces.cursos c
                WHERE c.cliente_id IN ({cid_list})
                  AND c.estado IN ('activo', 'en_espera')
                  AND c.fecha_inicio >= CURRENT_DATE
                ORDER BY c.fecha_inicio ASC
                LIMIT 5
            """)
        )
        return [
            {
                "curso_id": str(r[0]), "nombre": r[1],
                "fecha_inicio": r[2].isoformat() if r[2] else None,
                "fecha_fin": r[3].isoformat() if r[3] else None,
                "empresa": r[4] or "", "ciudad": r[5] or "",
                "modalidad": r[6] or "", "participantes": int(r[7] or 0),
            }
            for r in result.fetchall()
        ]

    async def get_actividad(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> list[dict]:
        org_id = organization_id(user_data)
        if not org_id:
            return []
        cid_list = f"'{org_id}'"
        result = await db.execute(
            text(f"""
                (SELECT 'constancia_emitida' AS tipo,
                        cp.fecha_emision_certificado AS fecha, c.nombre AS curso, p.nombre AS participante
                 FROM aaces.curso_participante cp
                 JOIN aaces.cursos c ON c.id = cp.curso_id
                 JOIN aaces.participantes p ON p.id = cp.participante_id
                 WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = true
                   AND cp.fecha_emision_certificado IS NOT NULL)
                UNION ALL
                (SELECT 'participante_registrado' AS tipo,
                        cp.fecha_creacion AS fecha, c.nombre AS curso, p.nombre AS participante
                 FROM aaces.curso_participante cp
                 JOIN aaces.cursos c ON c.id = cp.curso_id
                 JOIN aaces.participantes p ON p.id = cp.participante_id
                 WHERE c.cliente_id IN ({cid_list}))
                UNION ALL
                (SELECT 'curso_creado' AS tipo, c.fecha_creacion AS fecha, c.nombre AS curso, '' AS participante
                 FROM aaces.cursos c WHERE c.cliente_id IN ({cid_list}))
                ORDER BY fecha DESC LIMIT 20
            """)
        )
        return [
            {
                "tipo": r[0], "fecha": r[1].isoformat() if r[1] else None,
                "curso": r[2] or "", "participante": r[3] or "",
            }
            for r in result.fetchall()
        ]

    async def get_graficas(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> dict:
        org_id = organization_id(user_data)
        if not org_id:
            return {"constancias_mes": [], "cursos_categoria": []}
        cid_list = f"'{org_id}'"

        constancias_mes = await db.execute(
            text(f"""
                SELECT date_trunc('month', cp.fecha_emision_certificado) AS mes, count(*) AS emitidas
                FROM aaces.curso_participante cp
                JOIN aaces.cursos c ON c.id = cp.curso_id
                WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = true
                  AND cp.fecha_emision_certificado >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
                GROUP BY 1 ORDER BY 1
            """)
        )
        constancias = [
            {"mes": r[0].strftime("%Y-%m"), "emitidas": int(r[1] or 0)}
            for r in constancias_mes.fetchall()
        ]

        cat_result = await db.execute(
            text(f"""
                SELECT COALESCE(c.modalidad, 'General') AS categoria, count(*) AS cantidad
                FROM aaces.cursos c
                WHERE c.cliente_id IN ({cid_list}) AND c.estado IN ('activo', 'finalizado')
                GROUP BY 1 ORDER BY 2 DESC
            """)
        )
        categorias = []
        total = 0
        for r in cat_result.fetchall():
            cant = int(r[1] or 0)
            total += cant
            categorias.append({"categoria": r[0], "cantidad": cant})
        for item in categorias:
            item["porcentaje"] = round((item["cantidad"] / total * 100) if total > 0 else 0, 1)

        return {"constancias_mes": constancias, "cursos_categoria": categorias}

    async def get_confianza(
        self, db: AsyncSession, user_data: Dict[str, Any]
    ) -> dict:
        org_id = organization_id(user_data)
        if not org_id:
            return {"emitidos": 0, "consultados": 0, "tasa": 0, "ciudades": 0}
        cid_list = f"'{org_id}'"
        result = await db.execute(
            text(f"""
                SELECT
                    (SELECT count(*) FROM aaces.curso_participante cp
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list}) AND cp.estado_acreditacion = true) AS emitidos,
                    (SELECT count(DISTINCT vp.codigo_validacion)
                     FROM aaces.validaciones_publicas vp
                     JOIN aaces.curso_participante cp ON cp.codigo_validacion = vp.codigo_validacion
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list}) AND vp.resultado = true) AS consultados,
                    (SELECT count(DISTINCT vp.ip_validacion)
                     FROM aaces.validaciones_publicas vp
                     JOIN aaces.curso_participante cp ON cp.codigo_validacion = vp.codigo_validacion
                     JOIN aaces.cursos c ON c.id = cp.curso_id
                     WHERE c.cliente_id IN ({cid_list}) AND vp.resultado = true) AS ciudades
            """)
        )
        row = result.fetchone()
        emitidos = int(row[0] or 0) if row else 0
        consultados = int(row[1] or 0) if row else 0
        ciudades = int(row[2] or 0) if row else 0
        tasa = round((consultados / emitidos * 100), 1) if emitidos > 0 else 0
        return {"emitidos": emitidos, "consultados": consultados, "tasa": tasa, "ciudades": ciudades}


dashboard_service = DashboardService()
