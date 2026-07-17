from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any, Optional
import uuid
import logging

logger = logging.getLogger(__name__)


TIPO_DOCUMENTOS = ("CONSTANCIA", "DC3", "DIPLOMA", "CREDENCIAL", "OTRO")


class TemplateService:

    async def _get_org_id(
        self, user_data: Dict[str, Any]
    ) -> Optional[str]:
        source = user_data.get("source")
        if source == "usuario":
            return user_data.get("organizacion_id")
        return user_data.get("id")

    async def listar(
        self, db: AsyncSession, user_data: Dict[str, Any],
        tipo_documento: Optional[str] = None, solo_activas: bool = False
    ) -> list[dict]:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return []

        conditions = ["organizacion_id = :org_id"]
        params: Dict[str, Any] = {"org_id": org_id}

        if tipo_documento:
            conditions.append("tipo_documento = :tipo")
            params["tipo"] = tipo_documento
        if solo_activas:
            conditions.append("activa = true")

        where = " AND ".join(conditions)
        sql = f"""
            SELECT id, organizacion_id, template_group_id, tipo_documento,
                   version, nombre, activa, recursos, config,
                   html_template, fecha_creacion, creada_por
            FROM aaces.templates
            WHERE {where}
            ORDER BY tipo_documento, version DESC
        """
        result = await db.execute(text(sql), params)
        rows = result.fetchall()
        return [
            {
                "id": str(r[0]),
                "organizacion_id": str(r[1]),
                "template_group_id": str(r[2]),
                "tipo_documento": r[3],
                "version": r[4],
                "nombre": r[5],
                "activa": r[6],
                "recursos": r[7] or {},
                "config": r[8] or {},
                "html_template": r[9] or "",
                "fecha_creacion": r[10].isoformat() if r[10] else None,
                "creada_por": str(r[11]) if r[11] else None,
            }
            for r in rows
        ]

    async def obtener(
        self, db: AsyncSession, user_data: Dict[str, Any],
        template_id: str
    ) -> Optional[dict]:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return None

        result = await db.execute(
            text("""
                SELECT id, organizacion_id, template_group_id, tipo_documento,
                       version, nombre, activa, recursos, config,
                       html_template, fecha_creacion, creada_por
                FROM aaces.templates
                WHERE id = :id AND organizacion_id = :org_id
            """),
            {"id": template_id, "org_id": org_id}
        )
        row = result.fetchone()
        if not row:
            return None
        return {
            "id": str(row[0]),
            "organizacion_id": str(row[1]),
            "template_group_id": str(row[2]),
            "tipo_documento": row[3],
            "version": row[4],
            "nombre": row[5],
            "activa": row[6],
            "recursos": row[7] or {},
            "config": row[8] or {},
            "html_template": row[9] or "",
            "fecha_creacion": row[10].isoformat() if row[10] else None,
            "creada_por": str(row[11]) if row[11] else None,
        }

    async def crear(
        self, db: AsyncSession, user_data: Dict[str, Any],
        data: Dict[str, Any], creada_por: Optional[str] = None
    ) -> Optional[dict]:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return None

        tipo = data["tipo_documento"]
        nombre = data["nombre"]
        recursos = data.get("recursos") or {}
        config = data.get("config") or {}
        html_template = data.get("html_template") or ""

        # Generate template_group_id (new group for first version)
        template_group_id = str(uuid.uuid4())

        # Version = 1 for new template
        version = 1

        # Insert the template
        result = await db.execute(
            text("""
                INSERT INTO aaces.templates
                    (organizacion_id, template_group_id, tipo_documento,
                     version, nombre, activa, recursos, config,
                     html_template, creada_por)
                VALUES
                    (:org_id, :group_id, :tipo,
                     :version, :nombre, true, :recursos::jsonb, :config::jsonb,
                     :html, :creada_por)
                RETURNING id, fecha_creacion
            """),
            {
                "org_id": org_id,
                "group_id": template_group_id,
                "tipo": tipo,
                "version": version,
                "nombre": nombre,
                "recursos": str(recursos),
                "config": str(config),
                "html": html_template,
                "creada_por": creada_por,
            }
        )
        await db.commit()
        row = result.fetchone()
        if not row:
            await db.rollback()
            return None

        return {
            "id": str(row[0]),
            "organizacion_id": org_id,
            "template_group_id": template_group_id,
            "tipo_documento": tipo,
            "version": version,
            "nombre": nombre,
            "activa": True,
            "recursos": recursos,
            "config": config,
            "html_template": html_template,
            "fecha_creacion": row[1].isoformat() if row[1] else None,
            "creada_por": creada_por,
        }

    async def crear_version(
        self, db: AsyncSession, user_data: Dict[str, Any],
        template_group_id: str, data: Dict[str, Any],
        creada_por: Optional[str] = None
    ) -> Optional[dict]:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return None

        # Get current max version for this group
        max_ver = await db.execute(
            text("""
                SELECT COALESCE(MAX(version), 0)
                FROM aaces.templates
                WHERE organizacion_id = :org_id AND template_group_id = :group_id
            """),
            {"org_id": org_id, "group_id": template_group_id}
        )
        current_max = int(max_ver.scalar() or 0)
        new_version = current_max + 1

        exist_res = await db.execute(
            text("""
                SELECT tipo_documento FROM aaces.templates
                WHERE organizacion_id = :org_id AND template_group_id = :group_id
                LIMIT 1
            """),
            {"org_id": org_id, "group_id": template_group_id}
        )
        exist_row = exist_res.fetchone()
        if not exist_row:
            return None

        tipo = exist_row[0]
        nombre = data.get("nombre", "")
        recursos = data.get("recursos") or {}
        config = data.get("config") or {}
        html_template = data.get("html_template") or ""

        # Deactivate current active before inserting
        await db.execute(
            text("""
                UPDATE aaces.templates SET activa = false
                WHERE organizacion_id = :org_id AND template_group_id = :group_id AND activa = true
            """),
            {"org_id": org_id, "group_id": template_group_id}
        )

        result = await db.execute(
            text("""
                INSERT INTO aaces.templates
                    (organizacion_id, template_group_id, tipo_documento,
                     version, nombre, activa, recursos, config,
                     html_template, creada_por)
                VALUES
                    (:org_id, :group_id, :tipo,
                     :version, :nombre, true, :recursos::jsonb, :config::jsonb,
                     :html, :creada_por)
                RETURNING id, fecha_creacion
            """),
            {
                "org_id": org_id,
                "group_id": template_group_id,
                "tipo": tipo,
                "version": new_version,
                "nombre": nombre,
                "recursos": str(recursos),
                "config": str(config),
                "html": html_template,
                "creada_por": creada_por,
            }
        )
        await db.commit()
        row = result.fetchone()
        if not row:
            await db.rollback()
            return None

        return {
            "id": str(row[0]),
            "organizacion_id": org_id,
            "template_group_id": template_group_id,
            "tipo_documento": tipo,
            "version": new_version,
            "nombre": nombre,
            "activa": True,
            "recursos": recursos,
            "config": config,
            "html_template": html_template,
            "fecha_creacion": row[1].isoformat() if row[1] else None,
            "creada_por": creada_por,
        }

    async def obtener_versiones(
        self, db: AsyncSession, user_data: Dict[str, Any],
        template_group_id: str
    ) -> list[dict]:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return []

        result = await db.execute(
            text("""
                SELECT id, version, nombre, activa, creada_por, fecha_creacion
                FROM aaces.templates
                WHERE organizacion_id = :org_id AND template_group_id = :group_id
                ORDER BY version DESC
            """),
            {"org_id": org_id, "group_id": template_group_id}
        )
        return [
            {
                "id": str(r[0]),
                "version": r[1],
                "nombre": r[2],
                "activa": r[3],
                "creada_por": str(r[4]) if r[4] else None,
                "fecha_creacion": r[5].isoformat() if r[5] else None,
            }
            for r in result.fetchall()
        ]

    async def activar(
        self, db: AsyncSession, user_data: Dict[str, Any],
        template_id: str
    ) -> bool:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return False

        # Get the target template
        tpl = await self.obtener(db, user_data, template_id=template_id)
        if not tpl:
            return False

        group_id = tpl["template_group_id"]

        # Deactivate all in group, then activate target
        await db.execute(
            text("""
                UPDATE aaces.templates SET activa = false
                WHERE organizacion_id = :org_id AND template_group_id = :group_id
            """),
            {"org_id": org_id, "group_id": group_id}
        )
        await db.execute(
            text("""
                UPDATE aaces.templates SET activa = true
                WHERE id = :id AND organizacion_id = :org_id
            """),
            {"id": template_id, "org_id": org_id}
        )
        await db.commit()
        return True

    async def actualizar_recursos(
        self, db: AsyncSession, user_data: Dict[str, Any],
        template_id: str, recursos: dict
    ) -> bool:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return False

        result = await db.execute(
            text("""
                UPDATE aaces.templates
                SET recursos = :recursos::jsonb
                WHERE id = :id AND organizacion_id = :org_id
                RETURNING id
            """),
            {"id": template_id, "org_id": org_id, "recursos": json.dumps(recursos)},
        )
        await db.commit()
        return result.fetchone() is not None

    async def eliminar(
        self, db: AsyncSession, user_data: Dict[str, Any],
        template_id: str
    ) -> bool:
        org_id = await self._get_org_id(user_data)
        if not org_id:
            return False

        result = await db.execute(
            text("""
                DELETE FROM aaces.templates
                WHERE id = :id AND organizacion_id = :org_id
                RETURNING id
            """),
            {"id": template_id, "org_id": org_id}
        )
        await db.commit()
        return result.fetchone() is not None


template_service = TemplateService()
