"""Congruencia del DC-3: agente capacitador – curso registrado – instructor.

Problema que atiende: un DC-3 donde el agente, el curso o el instructor no
corresponden a lo que está registrado ante la STPS (p. ej. alguien sin registro
imparte el curso y otro agente firma). La Norma pide que el DC-3 lleve al agente
capacitador externo y al instructor que lo impartió.

Fase 1: lo declara la agencia (su plantilla de instructores y qué cursos tiene
registrados). AACES AVISA cuando algo no cuadra —no bloquea, porque hay casos
legítimos como nombres escritos distinto o registros en trámite— y guarda quién
decidió continuar. La verificación automática contra la STPS es la Fase 2.
"""
import json
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def revisar_curso(db: AsyncSession, curso_id: str) -> Dict[str, Any]:
    r = (await db.execute(text("""
        SELECT c.id, c.nombre, c.instructor_id, i.nombre, i.activo,
               cc.id, cc.nombre, cc.stps_registrado, cc.stps_nombre,
               o.id, o.stps_validado,
               EXISTS (SELECT 1 FROM aaces.instructor_cursos ic
                       WHERE ic.instructor_id = c.instructor_id AND ic.catalogo_curso_id = c.catalogo_curso_id)
        FROM aaces.cursos c
        JOIN aaces.clientes cl ON cl.id = c.cliente_id
        JOIN aaces.organizaciones o ON o.id = cl.organizacion_id
        LEFT JOIN aaces.instructores i ON i.id = c.instructor_id
        LEFT JOIN aaces.catalogo_cursos cc ON cc.id = c.catalogo_curso_id
        WHERE c.id = CAST(:id AS uuid)
    """), {"id": curso_id})).fetchone()
    if not r:
        return {"congruente": True, "avisos": []}
    (_, curso_nombre, instructor_id, instructor, instructor_activo,
     catalogo_id, catalogo_nombre, registrado, stps_nombre, org_id, agente_ok, autorizado) = r

    avisos: List[Dict[str, str]] = []
    if not agente_ok:
        avisos.append({"clave": "agente", "texto": "Tu registro como agente capacitador ante la STPS no está verificado."})
    if not catalogo_id:
        avisos.append({"clave": "curso_sin_catalogo",
                       "texto": "Este grupo no está ligado a un curso de tu catálogo, así que no podemos confirmar que el curso esté registrado ante la STPS."})
    elif not registrado:
        avisos.append({"clave": "curso_no_registrado",
                       "texto": f"El curso “{catalogo_nombre}” no está marcado como registrado ante la STPS en tu catálogo."})
    if not instructor_id:
        avisos.append({"clave": "sin_instructor", "texto": "El grupo no tiene instructor asignado; el DC-3 debe llevar el nombre de quien impartió el curso."})
    else:
        if not instructor_activo:
            avisos.append({"clave": "instructor_inactivo", "texto": f"{instructor} está dado de baja en tu plantilla de instructores."})
        if catalogo_id and not autorizado:
            avisos.append({"clave": "instructor_no_autorizado",
                           "texto": f"{instructor} no está en tu plantilla para impartir “{catalogo_nombre}”."})
    return {
        "congruente": not avisos,
        "avisos": avisos,
        "organizacion_id": str(org_id),
        "curso": {"nombre": catalogo_nombre or curso_nombre, "registrado": bool(registrado), "stps_nombre": stps_nombre},
        "instructor": {"id": str(instructor_id), "nombre": instructor, "autorizado": bool(autorizado)} if instructor_id else None,
    }


async def exigir_confirmacion(db: AsyncSession, curso_id: str, accion: str, confirmado: bool,
                              usuario_id: Optional[str]) -> Dict[str, Any]:
    """Antes de dar folios: si hay avisos y no se confirmaron, responde 409 con ellos.
    Si se confirmaron, deja registro de quién decidió continuar."""
    rev = await revisar_curso(db, curso_id)
    if rev["congruente"]:
        return rev
    if not confirmado:
        raise HTTPException(status_code=409, detail={
            "codigo": "congruencia",
            "mensaje": "Revisa estos avisos antes de continuar.",
            "avisos": rev["avisos"],
        })
    await db.execute(text("""
        INSERT INTO aaces.avisos_congruencia (organizacion_id, curso_id, accion, avisos, usuario_id)
        VALUES (CAST(:o AS uuid), CAST(:c AS uuid), :a, CAST(:av AS jsonb), CAST(:u AS uuid))
    """), {"o": rev["organizacion_id"], "c": curso_id, "a": accion,
           "av": json.dumps(rev["avisos"], ensure_ascii=False), "u": usuario_id})
    return rev
