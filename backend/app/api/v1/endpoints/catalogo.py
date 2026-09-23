"""Catálogo de cursos y paquetes por organización.

Las organizaciones definen una vez los cursos que imparten (nombre, duración,
vigencia, precio, ciudad/estado, modalidad) y los reutilizan al programar
cursos, sin reescribir datos en cada constancia. `publicado` (default false)
marca lo que la org elige mostrar en el futuro directorio público.
Todo el módulo está aislado por organizacion_id: nunca se exponen ni se
modifican catálogos de otras organizaciones.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity import get_current_identity, require_org_id, Identity

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CatalogoCursoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    duracion_horas: int = Field(8, ge=1)
    vigencia_meses: int = Field(24, ge=1)
    precio: float = Field(0, ge=0)
    moneda: str = Field("MXN", max_length=3)
    ciudad: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=100)
    modalidad: str = Field("presencial", pattern="^(presencial|virtual|mixta)$")
    publicado: bool = False


class CatalogoCursoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    descripcion: Optional[str] = None
    duracion_horas: Optional[int] = Field(None, ge=1)
    vigencia_meses: Optional[int] = Field(None, ge=1)
    precio: Optional[float] = Field(None, ge=0)
    moneda: Optional[str] = Field(None, max_length=3)
    ciudad: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=100)
    modalidad: Optional[str] = Field(None, pattern="^(presencial|virtual|mixta)$")
    publicado: Optional[bool] = None
    activo: Optional[bool] = None


class PublicarBody(BaseModel):
    publicado: bool


class PaqueteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    precio: float = Field(0, ge=0)
    moneda: str = Field("MXN", max_length=3)
    publicado: bool = False
    curso_ids: List[str] = Field(default_factory=list)


class PaqueteUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    descripcion: Optional[str] = None
    precio: Optional[float] = Field(None, ge=0)
    moneda: Optional[str] = Field(None, max_length=3)
    publicado: Optional[bool] = None
    activo: Optional[bool] = None
    curso_ids: Optional[List[str]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _scoped_org_id(identity: Identity, db: AsyncSession) -> str:
    org_id = await require_org_id(db, identity)
    await db.execute(text("SET LOCAL search_path TO aaces"))
    return org_id


def _row_to_curso(r) -> dict:
    return {
        "id": str(r[0]),
        "nombre": r[1],
        "descripcion": r[2],
        "duracion_horas": r[3],
        "vigencia_meses": r[4],
        "precio": float(r[5]) if r[5] is not None else 0,
        "moneda": r[6],
        "ciudad": r[7],
        "estado": r[8],
        "modalidad": r[9],
        "publicado": bool(r[10]),
        "activo": bool(r[11]),
        "fecha_creacion": r[12].isoformat() if isinstance(r[12], datetime) else r[12],
    }


async def _get_curso_or_404(db: AsyncSession, curso_id: str, org_id: str):
    res = await db.execute(
        text("""
            SELECT id, nombre, descripcion, duracion_horas, vigencia_meses,
                   precio, moneda, ciudad, estado, modalidad, publicado, activo,
                   fecha_creacion
            FROM catalogo_cursos
            WHERE id = :id AND organizacion_id = :org_id
            LIMIT 1
        """),
        {"id": curso_id, "org_id": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Curso del catálogo no encontrado")
    return row


async def _get_paquete_or_404(db: AsyncSession, paquete_id: str, org_id: str):
    res = await db.execute(
        text("""
            SELECT id, nombre, descripcion, precio, moneda, publicado, activo,
                   fecha_creacion
            FROM paquetes
            WHERE id = :id AND organizacion_id = :org_id
            LIMIT 1
        """),
        {"id": paquete_id, "org_id": org_id},
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")
    return row


async def _paquete_cursos(db: AsyncSession, paquete_id: str) -> list:
    res = await db.execute(
        text("""
            SELECT c.id, c.nombre, c.duracion_horas, c.vigencia_meses, c.precio
            FROM paquete_cursos pc
            JOIN catalogo_cursos c ON c.id = pc.catalogo_curso_id
            WHERE pc.paquete_id = :pid
            ORDER BY c.nombre
        """),
        {"pid": paquete_id},
    )
    return [
        {
            "id": str(r[0]),
            "nombre": r[1],
            "duracion_horas": r[2],
            "vigencia_meses": r[3],
            "precio": float(r[4]) if r[4] is not None else 0,
        }
        for r in res.fetchall()
    ]


def _row_to_paquete(r, cursos: list) -> dict:
    return {
        "id": str(r[0]),
        "nombre": r[1],
        "descripcion": r[2],
        "precio": float(r[3]) if r[3] is not None else 0,
        "moneda": r[4],
        "publicado": bool(r[5]),
        "activo": bool(r[6]),
        "fecha_creacion": r[7].isoformat() if isinstance(r[7], datetime) else r[7],
        "cursos": cursos,
    }


async def _validar_cursos_propios(db: AsyncSession, curso_ids: List[str], org_id: str):
    """Todos los curso_ids deben existir, estar activos y ser de la org."""
    if not curso_ids:
        return
    res = await db.execute(
        text("""
            SELECT id FROM catalogo_cursos
            WHERE organizacion_id = :org_id AND activo = true
              AND id = ANY(CAST(:ids AS uuid[]))
        """),
        {"org_id": org_id, "ids": list(set(curso_ids))},
    )
    validos = {str(r[0]) for r in res.fetchall()}
    invalidos = [c for c in set(curso_ids) if c not in validos]
    if invalidos:
        raise HTTPException(
            status_code=400,
            detail="Cursos inválidos o de otra organización",
        )


# ---------------------------------------------------------------------------
# Catálogo de cursos
# ---------------------------------------------------------------------------

@router.get("/cursos", response_model=List[dict])
async def listar_catalogo(
    q: Optional[str] = Query(None, max_length=100),
    publicados: Optional[bool] = Query(None),
    solo_activos: bool = Query(True),
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    conds = ["organizacion_id = :org_id"]
    params: dict = {"org_id": org_id}
    if solo_activos:
        conds.append("activo = true")
    if publicados is not None:
        conds.append("publicado = :pub")
        params["pub"] = publicados
    if q:
        conds.append("(nombre ILIKE :q OR descripcion ILIKE :q)")
        params["q"] = f"%{q}%"
    res = await db.execute(
        text(f"""
            SELECT id, nombre, descripcion, duracion_horas, vigencia_meses,
                   precio, moneda, ciudad, estado, modalidad, publicado, activo,
                   fecha_creacion
            FROM catalogo_cursos
            WHERE {' AND '.join(conds)}
            ORDER BY nombre
        """),
        params,
    )
    return [_row_to_curso(r) for r in res.fetchall()]


@router.post("/cursos", status_code=status.HTTP_201_CREATED)
async def crear_curso_catalogo(
    payload: CatalogoCursoCreate,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    res = await db.execute(
        text("""
            INSERT INTO catalogo_cursos
                (organizacion_id, nombre, descripcion, duracion_horas,
                 vigencia_meses, precio, moneda, ciudad, estado, modalidad, publicado)
            VALUES
                (:org_id, :nombre, :descripcion, :duracion_horas,
                 :vigencia_meses, :precio, :moneda, :ciudad, :estado, :modalidad, :publicado)
            RETURNING id, nombre, descripcion, duracion_horas, vigencia_meses,
                      precio, moneda, ciudad, estado, modalidad, publicado, activo,
                      fecha_creacion
        """),
        {
            "org_id": org_id,
            "nombre": payload.nombre.strip(),
            "descripcion": payload.descripcion,
            "duracion_horas": payload.duracion_horas,
            "vigencia_meses": payload.vigencia_meses,
            "precio": payload.precio,
            "moneda": payload.moneda,
            "ciudad": payload.ciudad.strip() if payload.ciudad else None,
            "estado": payload.estado.strip() if payload.estado else None,
            "modalidad": payload.modalidad,
            "publicado": payload.publicado,
        },
    )
    await db.commit()
    return _row_to_curso(res.fetchone())


@router.put("/cursos/{curso_id}")
async def actualizar_curso_catalogo(
    curso_id: str,
    payload: CatalogoCursoUpdate,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    await _get_curso_or_404(db, curso_id, org_id)
    campos = payload.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=400, detail="Sin cambios")
    sets = []
    params: dict = {"id": curso_id, "org_id": org_id}
    for k, v in campos.items():
        if k in ("nombre", "ciudad", "estado") and isinstance(v, str):
            v = v.strip() or None
        sets.append(f"{k} = :{k}")
        params[k] = v
    sets.append("fecha_actualizacion = CURRENT_TIMESTAMP")
    await db.execute(
        text(f"""
            UPDATE catalogo_cursos SET {', '.join(sets)}
            WHERE id = :id AND organizacion_id = :org_id
        """),
        params,
    )
    await db.commit()
    row = await _get_curso_or_404(db, curso_id, org_id)
    return _row_to_curso(row)


@router.patch("/cursos/{curso_id}/publicar")
async def publicar_curso_catalogo(
    curso_id: str,
    payload: PublicarBody,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    await _get_curso_or_404(db, curso_id, org_id)
    await db.execute(
        text("""
            UPDATE catalogo_cursos
            SET publicado = :pub, fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = :id AND organizacion_id = :org_id
        """),
        {"pub": payload.publicado, "id": curso_id, "org_id": org_id},
    )
    await db.commit()
    return {"id": curso_id, "publicado": payload.publicado}


@router.delete("/cursos/{curso_id}")
async def eliminar_curso_catalogo(
    curso_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    # Baja lógica: no rompe cursos programados ni paquetes que lo referencian.
    org_id = await _scoped_org_id(identity, db)
    await _get_curso_or_404(db, curso_id, org_id)
    await db.execute(
        text("""
            UPDATE catalogo_cursos
            SET activo = false, publicado = false, fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = :id AND organizacion_id = :org_id
        """),
        {"id": curso_id, "org_id": org_id},
    )
    await db.commit()
    return {"id": curso_id, "activo": False}


# ---------------------------------------------------------------------------
# Paquetes
# ---------------------------------------------------------------------------

@router.get("/paquetes", response_model=List[dict])
async def listar_paquetes(
    solo_activos: bool = Query(True),
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    cond = "AND activo = true" if solo_activos else ""
    res = await db.execute(
        text(f"""
            SELECT id, nombre, descripcion, precio, moneda, publicado, activo,
                   fecha_creacion
            FROM paquetes
            WHERE organizacion_id = :org_id {cond}
            ORDER BY nombre
        """),
        {"org_id": org_id},
    )
    out = []
    for r in res.fetchall():
        cursos = await _paquete_cursos(db, str(r[0]))
        out.append(_row_to_paquete(r, cursos))
    return out


@router.post("/paquetes", status_code=status.HTTP_201_CREATED)
async def crear_paquete(
    payload: PaqueteCreate,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    await _validar_cursos_propios(db, payload.curso_ids, org_id)
    res = await db.execute(
        text("""
            INSERT INTO paquetes
                (organizacion_id, nombre, descripcion, precio, moneda, publicado)
            VALUES
                (:org_id, :nombre, :descripcion, :precio, :moneda, :publicado)
            RETURNING id, nombre, descripcion, precio, moneda, publicado, activo,
                      fecha_creacion
        """),
        {
            "org_id": org_id,
            "nombre": payload.nombre.strip(),
            "descripcion": payload.descripcion,
            "precio": payload.precio,
            "moneda": payload.moneda,
            "publicado": payload.publicado,
        },
    )
    row = res.fetchone()
    pid = str(row[0])
    for cid in set(payload.curso_ids):
        await db.execute(
            text("INSERT INTO paquete_cursos (paquete_id, catalogo_curso_id) VALUES (:pid, :cid) ON CONFLICT DO NOTHING"),
            {"pid": pid, "cid": cid},
        )
    await db.commit()
    return _row_to_paquete(row, await _paquete_cursos(db, pid))


@router.put("/paquetes/{paquete_id}")
async def actualizar_paquete(
    paquete_id: str,
    payload: PaqueteUpdate,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    await _get_paquete_or_404(db, paquete_id, org_id)
    campos = payload.model_dump(exclude_unset=True)
    curso_ids = campos.pop("curso_ids", None)
    if curso_ids is not None:
        await _validar_cursos_propios(db, curso_ids, org_id)
        await db.execute(
            text("DELETE FROM paquete_cursos WHERE paquete_id = :pid"),
            {"pid": paquete_id},
        )
        for cid in set(curso_ids):
            await db.execute(
                text("INSERT INTO paquete_cursos (paquete_id, catalogo_curso_id) VALUES (:pid, :cid) ON CONFLICT DO NOTHING"),
                {"pid": paquete_id, "cid": cid},
            )
    if campos:
        sets = []
        params: dict = {"id": paquete_id, "org_id": org_id}
        for k, v in campos.items():
            if k == "nombre" and isinstance(v, str):
                v = v.strip()
            sets.append(f"{k} = :{k}")
            params[k] = v
        sets.append("fecha_actualizacion = CURRENT_TIMESTAMP")
        await db.execute(
            text(f"""
                UPDATE paquetes SET {', '.join(sets)}
                WHERE id = :id AND organizacion_id = :org_id
            """),
            params,
        )
    await db.commit()
    row = await _get_paquete_or_404(db, paquete_id, org_id)
    return _row_to_paquete(row, await _paquete_cursos(db, paquete_id))


@router.patch("/paquetes/{paquete_id}/publicar")
async def publicar_paquete(
    paquete_id: str,
    payload: PublicarBody,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    await _get_paquete_or_404(db, paquete_id, org_id)
    await db.execute(
        text("""
            UPDATE paquetes
            SET publicado = :pub, fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = :id AND organizacion_id = :org_id
        """),
        {"pub": payload.publicado, "id": paquete_id, "org_id": org_id},
    )
    await db.commit()
    return {"id": paquete_id, "publicado": payload.publicado}


@router.delete("/paquetes/{paquete_id}")
async def eliminar_paquete(
    paquete_id: str,
    identity: Identity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _scoped_org_id(identity, db)
    await _get_paquete_or_404(db, paquete_id, org_id)
    await db.execute(
        text("""
            UPDATE paquetes
            SET activo = false, publicado = false, fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = :id AND organizacion_id = :org_id
        """),
        {"id": paquete_id, "org_id": org_id},
    )
    await db.commit()
    return {"id": paquete_id, "activo": False}
