"""Plantilla de instructores de la agencia y los cursos que cada uno puede impartir
(lo que tiene registrado ante la STPS). Ver app/services/congruencia.py."""
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.identity import Identity, get_current_identity, require_org_id

router = APIRouter()


class InstructorIn(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=200)
    curp: Optional[str] = Field(None, max_length=18)
    correo: Optional[str] = Field(None, max_length=255)
    activo: bool = True
    cursos: List[str] = Field(default_factory=list)  # ids de catalogo_cursos


def _curp(v: Optional[str]) -> Optional[str]:
    s = re.sub(r"\s", "", (v or "")).upper()
    if s and (len(s) != 18 or not s.isalnum()):
        raise HTTPException(400, "La CURP debe tener 18 caracteres (letras y números)")
    return s or None


async def _listar(db: AsyncSession, org_id: str, instructor_id: Optional[str] = None) -> list:
    filtro = "AND i.id = CAST(:iid AS uuid)" if instructor_id else ""
    rows = (await db.execute(text(f"""
        SELECT i.id, i.nombre, i.curp, i.correo, i.activo,
               COALESCE(json_agg(json_build_object('id', cc.id, 'nombre', cc.nombre, 'stps_registrado', cc.stps_registrado)
                                 ORDER BY cc.nombre) FILTER (WHERE cc.id IS NOT NULL), '[]'),
               (SELECT count(*) FROM aaces.cursos c WHERE c.instructor_id = i.id)
        FROM aaces.instructores i
        LEFT JOIN aaces.instructor_cursos ic ON ic.instructor_id = i.id
        LEFT JOIN aaces.catalogo_cursos cc ON cc.id = ic.catalogo_curso_id AND cc.activo
        WHERE i.organizacion_id = CAST(:o AS uuid) {filtro}
        GROUP BY i.id ORDER BY i.activo DESC, i.nombre
    """), {"o": org_id, "iid": instructor_id})).fetchall()
    return [{"id": str(r[0]), "nombre": r[1], "curp": r[2], "correo": r[3], "activo": r[4],
             "cursos": r[5], "grupos": int(r[6] or 0)} for r in rows]


async def _guardar_cursos(db: AsyncSession, org_id: str, instructor_id: str, cursos: List[str]) -> None:
    await db.execute(text("DELETE FROM aaces.instructor_cursos WHERE instructor_id = CAST(:i AS uuid)"), {"i": instructor_id})
    if cursos:
        # Solo cursos del catálogo de la propia organización
        await db.execute(text("""
            INSERT INTO aaces.instructor_cursos (instructor_id, catalogo_curso_id)
            SELECT CAST(:i AS uuid), id FROM aaces.catalogo_cursos
            WHERE organizacion_id = CAST(:o AS uuid) AND id = ANY(CAST(:ids AS uuid[]))
        """), {"i": instructor_id, "o": org_id, "ids": cursos})


@router.get("")
async def listar(identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    return await _listar(db, await require_org_id(db, identity))


@router.post("", status_code=201)
async def crear(body: InstructorIn, identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    org_id = await require_org_id(db, identity)
    iid = (await db.execute(text("""
        INSERT INTO aaces.instructores (organizacion_id, nombre, curp, correo, activo)
        VALUES (CAST(:o AS uuid), :n, :c, :e, :a) RETURNING id
    """), {"o": org_id, "n": body.nombre.strip(), "c": _curp(body.curp), "e": (body.correo or "").strip() or None, "a": body.activo})).scalar()
    await _guardar_cursos(db, org_id, str(iid), body.cursos)
    await db.commit()
    return (await _listar(db, org_id, str(iid)))[0]


@router.put("/{instructor_id}")
async def actualizar(instructor_id: str, body: InstructorIn, identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    org_id = await require_org_id(db, identity)
    r = await db.execute(text("""
        UPDATE aaces.instructores SET nombre = :n, curp = :c, correo = :e, activo = :a, fecha_actualizacion = now()
        WHERE id = CAST(:i AS uuid) AND organizacion_id = CAST(:o AS uuid)
    """), {"i": instructor_id, "o": org_id, "n": body.nombre.strip(), "c": _curp(body.curp), "e": (body.correo or "").strip() or None, "a": body.activo})
    if not r.rowcount:
        raise HTTPException(404, "Instructor no encontrado")
    await _guardar_cursos(db, org_id, instructor_id, body.cursos)
    await db.commit()
    return (await _listar(db, org_id, instructor_id))[0]


@router.delete("/{instructor_id}", status_code=204)
async def eliminar(instructor_id: str, identity: Identity = Depends(get_current_identity), db: AsyncSession = Depends(get_db)):
    """Si ya impartió grupos se da de baja (no se borra), para no romper DC-3 emitidos."""
    org_id = await require_org_id(db, identity)
    usado = (await db.execute(text("SELECT EXISTS (SELECT 1 FROM aaces.cursos WHERE instructor_id = CAST(:i AS uuid))"), {"i": instructor_id})).scalar()
    q = "UPDATE aaces.instructores SET activo = false, fecha_actualizacion = now()" if usado else "DELETE FROM aaces.instructores"
    r = await db.execute(text(f"{q} WHERE id = CAST(:i AS uuid) AND organizacion_id = CAST(:o AS uuid)"), {"i": instructor_id, "o": org_id})
    if not r.rowcount:
        raise HTTPException(404, "Instructor no encontrado")
    await db.commit()
