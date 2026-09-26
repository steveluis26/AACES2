"""Plantillas PDF del cliente: su propio formato (DC-3, constancia, diploma) con
campos colocados visualmente. Genera un PDF por participante (todos en un solo
archivo) escribiendo los datos encima del formato original.

Coordenadas de los campos: porcentajes (0-100) relativos a la página, con origen
arriba a la izquierda, igual que en el editor del navegador.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import qrcode
from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from app.core.cifrado import descifrar

logger = logging.getLogger(__name__)

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PAGINAS = 4
FUENTES = {False: "Helvetica", True: "Helvetica-Bold"}

# Catálogo de campos disponibles en el editor: clave -> (etiqueta, grupo, ejemplo)
# Campos que se dibujan como imagen (firmas)
IMAGENES = {"firma_instructor", "firma_patron", "firma_trabajadores"}

CAMPOS: Dict[str, Tuple[str, str, str]] = {
    "participante_nombre": ("Nombre completo", "Participante", "MARÍA FERNANDA LÓPEZ RUIZ"),
    "participante_nombres": ("Nombre(s)", "Participante", "MARÍA FERNANDA"),
    "participante_apellidos": ("Apellidos", "Participante", "LÓPEZ RUIZ"),
    "curp": ("CURP", "Participante", "LORM900101MQTPZR05"),
    "ocupacion": ("Ocupación específica", "Participante", "SUPERVISORA DE SEGURIDAD"),
    "puesto": ("Puesto", "Participante", "SUPERVISORA"),
    "empresa": ("Empresa del trabajador", "Participante", "GRUPO INDUSTRIAL DEL BAJÍO"),
    "curso_nombre": ("Nombre del curso", "Curso", "TRABAJOS EN ALTURAS NOM-009-STPS-2011"),
    "curso_horas": ("Duración (solo número)", "Curso", "16"),
    "curso_duracion": ("Duración (con 'horas')", "Curso", "16 HORAS"),
    "fecha_inicio": ("Fecha de inicio", "Curso", "05/10/2026"),
    "fecha_fin": ("Fecha de término", "Curso", "06/10/2026"),
    "periodo": ("Periodo (inicio al fin)", "Curso", "05/10/2026 AL 06/10/2026"),
    "inicio_anio": ("Inicio · año", "Fechas para casillas", "2026"),
    "inicio_mes": ("Inicio · mes", "Fechas para casillas", "10"),
    "inicio_dia": ("Inicio · día", "Fechas para casillas", "05"),
    "fin_anio": ("Término · año", "Fechas para casillas", "2026"),
    "fin_mes": ("Término · mes", "Fechas para casillas", "10"),
    "fin_dia": ("Término · día", "Fechas para casillas", "06"),
    "ciudad": ("Ciudad del curso", "Curso", "QUERÉTARO"),
    "capacitador": ("Agente capacitador", "Capacitador", "CAS CAPACITACIÓN Y ADIESTRAMIENTO"),
    "registro_stps": ("Registro STPS", "Capacitador", "CAS-150312-AB7"),
    "instructor": ("Instructor", "Capacitador", "ING. JUAN PÉREZ LÓPEZ"),
    "fecha_emision": ("Fecha de emisión", "Documento", "06/10/2026"),
    "folio": ("Folio / ID certificado", "Documento", "CERT-A7AD98C5"),
    "codigo_validacion": ("Código de validación", "Documento", "5D1627E0"),
    "url_verificacion": ("Liga de verificación", "Documento", "https://aaces.mx/v/5D1627E0"),
    "qr": ("Código QR", "Documento", ""),
    "firma_instructor": ("Firma del instructor", "Firmas", ""),
    "firma_patron": ("Firma del patrón o representante legal", "Firmas", ""),
    "nombre_patron": ("Nombre del patrón o representante legal", "Firmas", "LIC. ROBERTO SALINAS MEJÍA"),
    "firma_trabajadores": ("Firma del representante de los trabajadores", "Firmas", ""),
    "nombre_trabajadores": ("Nombre del representante de los trabajadores", "Firmas", "JUAN GARCÍA TORRES"),
    "texto": ("Texto fijo", "Otros", "TEXTO FIJO"),
}


@dataclass
class Campo:
    clave: str
    pagina: int
    x: float
    y: float
    w: float
    h: float
    tam: float = 10
    alineacion: str = "left"
    negrita: bool = False
    espaciado: float = 0
    mayusculas: bool = True
    color: str = "#111111"
    texto: str = ""
    casillas: int = 0  # >0: una letra centrada por casilla (CURP, fechas del DC-3)

    @staticmethod
    def desde(d: Dict[str, Any]) -> Optional["Campo"]:
        clave = str(d.get("clave") or "")
        if clave not in CAMPOS:
            return None
        try:
            return Campo(
                clave=clave,
                pagina=max(0, int(d.get("pagina") or 0)),
                x=_pct(d.get("x")), y=_pct(d.get("y")),
                w=max(0.5, _pct(d.get("w"), 20)), h=max(0.5, _pct(d.get("h"), 3)),
                tam=min(72.0, max(4.0, float(d.get("tam") or 10))),
                alineacion=d.get("alineacion") if d.get("alineacion") in ("left", "center", "right") else "left",
                negrita=bool(d.get("negrita")),
                espaciado=min(40.0, max(0.0, float(d.get("espaciado") or 0))),
                mayusculas=d.get("mayusculas") is not False,
                color=str(d.get("color") or "#111111")[:7],
                texto=str(d.get("texto") or "")[:300],
                casillas=min(40, max(0, int(d.get("casillas") or 0))),
            )
        except (TypeError, ValueError):
            return None


def _pct(v: Any, defecto: float = 0) -> float:
    try:
        return min(100.0, max(0.0, float(v)))
    except (TypeError, ValueError):
        return defecto


def limpiar_campos(campos: Any) -> List[Dict[str, Any]]:
    """Valida lo que manda el editor; descarta claves desconocidas."""
    out = []
    for d in campos if isinstance(campos, list) else []:
        c = Campo.desde(d) if isinstance(d, dict) else None
        if c:
            out.append(c.__dict__)
    return out[:120]


# ---------------------------------------------------------------------------
# Subida: PDF o imagen -> PDF normalizado (sin rotación) + tamaño de páginas
# ---------------------------------------------------------------------------

def normalizar_archivo(contenido: bytes, nombre: str) -> Tuple[bytes, List[Dict[str, float]]]:
    if not contenido:
        raise ValueError("El archivo está vacío")
    if len(contenido) > MAX_BYTES:
        raise ValueError("El archivo supera 10 MB")
    ext = (nombre or "").lower().rsplit(".", 1)[-1]

    if ext in ("png", "jpg", "jpeg") or contenido[:4] in (b"\x89PNG",) or contenido[:3] == b"\xff\xd8\xff":
        return _imagen_a_pdf(contenido)
    if ext in ("doc", "docx"):
        raise ValueError("Guarda tu documento de Word como PDF (Archivo → Guardar como → PDF) y súbelo de nuevo")
    if not contenido.startswith(b"%PDF"):
        raise ValueError("Formato no soportado. Sube un PDF, PNG o JPG")

    try:
        reader = PdfReader(io.BytesIO(contenido))
    except Exception:
        raise ValueError("No pudimos leer el PDF. ¿Está dañado?")
    if reader.is_encrypted:
        raise ValueError("El PDF está protegido con contraseña. Quita la protección y súbelo de nuevo")
    if len(reader.pages) == 0:
        raise ValueError("El PDF no tiene páginas")
    if len(reader.pages) > MAX_PAGINAS:
        raise ValueError(f"El PDF tiene {len(reader.pages)} páginas; el máximo es {MAX_PAGINAS}")

    writer = PdfWriter()
    for page in reader.pages:
        # Deja la rotación "horneada" en el contenido para que las coordenadas coincidan con lo que se ve
        if (page.rotation or 0) % 360:
            page.transfer_rotation_to_content()
        writer.add_page(page)
    buf = io.BytesIO()
    writer.write(buf)
    pdf = buf.getvalue()
    return pdf, paginas_de(pdf)


def _imagen_a_pdf(contenido: bytes) -> Tuple[bytes, List[Dict[str, float]]]:
    from PIL import Image
    try:
        img = Image.open(io.BytesIO(contenido))
        img.load()
    except Exception:
        raise ValueError("No pudimos leer la imagen")
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    iw, ih = img.size
    # Tamaño carta (612 x 792 pt) respetando orientación y proporción de la imagen
    horizontal = iw > ih
    pw, ph = (792.0, 612.0) if horizontal else (612.0, 792.0)
    escala = min(pw / iw, ph / ih)
    dw, dh = iw * escala, ih * escala
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(pw, ph))
    c.drawImage(ImageReader(img), (pw - dw) / 2, (ph - dh) / 2, dw, dh)
    c.showPage()
    c.save()
    pdf = buf.getvalue()
    return pdf, paginas_de(pdf)


def paginas_de(pdf: bytes) -> List[Dict[str, float]]:
    reader = PdfReader(io.BytesIO(pdf))
    return [{"w": float(p.cropbox.width), "h": float(p.cropbox.height)} for p in reader.pages]


# ---------------------------------------------------------------------------
# Datos del participante -> valores de los campos
# ---------------------------------------------------------------------------

def _fecha(v: Any) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return datetime.fromisoformat(str(v)[:10]).date()
    except ValueError:
        return None


def valores_participante(r: Dict[str, Any], url_base: str) -> Dict[str, str]:
    ini, fin = _fecha(r.get("fecha_inicio")), _fecha(r.get("fecha_fin")) or _fecha(r.get("fecha_inicio"))
    emision = _fecha(r.get("fecha_emision")) or date.today()
    nombres = (r.get("nombre") or "").strip()
    apellidos = " ".join(x for x in [r.get("apellido_paterno"), r.get("apellido_materno")] if x) or (r.get("apellido") or "")
    horas = r.get("duracion_horas")
    f = lambda d: d.strftime("%d/%m/%Y") if d else ""
    codigo = r.get("codigo_validacion") or ""
    return {
        "participante_nombre": " ".join(x for x in [nombres, apellidos] if x).strip(),
        "participante_nombres": nombres,
        "participante_apellidos": apellidos.strip(),
        "curp": (descifrar(r.get("curp")) or "").strip(),
        "ocupacion": (r.get("ocupacion") or "").strip(),
        "puesto": (r.get("cargo") or "").strip(),
        "empresa": (r.get("empresa") or r.get("empresa_contratante") or "").strip(),
        "curso_nombre": (r.get("curso_nombre") or "").strip(),
        "curso_horas": str(horas) if horas else "",
        "curso_duracion": f"{horas} horas" if horas else "",
        "fecha_inicio": f(ini),
        "fecha_fin": f(fin),
        "periodo": f"{f(ini)} al {f(fin)}" if ini and fin and ini != fin else f(ini),
        "inicio_anio": ini.strftime("%Y") if ini else "",
        "inicio_mes": ini.strftime("%m") if ini else "",
        "inicio_dia": ini.strftime("%d") if ini else "",
        "fin_anio": fin.strftime("%Y") if fin else "",
        "fin_mes": fin.strftime("%m") if fin else "",
        "fin_dia": fin.strftime("%d") if fin else "",
        "ciudad": (r.get("ciudad") or "").strip(),
        "capacitador": (r.get("capacitador") or "").strip(),
        "registro_stps": (r.get("registro_stps") or "").strip(),
        "instructor": (r.get("instructor") or "").strip(),
        "nombre_patron": (r.get("nombre_patron") or "").strip(),
        "nombre_trabajadores": (r.get("nombre_trabajadores") or "").strip(),
        # Imágenes (bytes PNG): se dibujan dentro de su recuadro
        "firma_instructor": bytes(r["firma_instructor"]) if r.get("firma_instructor") else None,
        "firma_patron": bytes(r["firma_patron"]) if r.get("firma_patron") else None,
        "firma_trabajadores": bytes(r["firma_trabajadores"]) if r.get("firma_trabajadores") else None,
        "fecha_emision": f(emision),
        "folio": r.get("id_certificado") or "",
        "codigo_validacion": codigo,
        "url_verificacion": f"{url_base.rstrip('/')}/{codigo}" if codigo else "",
        "qr": f"{url_base.rstrip('/')}/{codigo}" if codigo else "",
    }


def valores_ejemplo(url_base: str) -> Dict[str, str]:
    v = {k: ej for k, (_, _, ej) in CAMPOS.items()}
    v["url_verificacion"] = f"{url_base.rstrip('/')}/5D1627E0"
    v["qr"] = v["url_verificacion"]
    from app.services.firmas import ejemplo
    muestra = ejemplo()
    for clave in IMAGENES:
        v[clave] = muestra
    return v


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def _hex(color: str) -> Tuple[float, float, float]:
    c = color.lstrip("#")
    if len(c) != 6:
        return (0.07, 0.07, 0.07)
    try:
        return tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return (0.07, 0.07, 0.07)


def _ancho(texto: str, fuente: str, tam: float, espaciado: float) -> float:
    return stringWidth(texto, fuente, tam) + espaciado * max(0, len(texto) - 1)


def _dibujar_texto(c: canvas.Canvas, campo: Campo, texto: str, pw: float, ph: float) -> None:
    if not texto:
        return
    if campo.mayusculas:
        texto = texto.upper()
    fuente = FUENTES[campo.negrita]
    if campo.casillas:
        _dibujar_casillas(c, campo, texto, fuente, pw, ph)
        return
    x = campo.x / 100 * pw
    w = campo.w / 100 * pw
    top = ph - campo.y / 100 * ph
    h = campo.h / 100 * ph
    tam = campo.tam
    # Si no cabe, reduce la letra hasta 60% del tamaño elegido; después recorta
    while _ancho(texto, fuente, tam, campo.espaciado) > w and tam > campo.tam * 0.6:
        tam -= 0.25
    while _ancho(texto, fuente, tam, campo.espaciado) > w and len(texto) > 1:
        texto = texto[:-1]
    ancho = _ancho(texto, fuente, tam, campo.espaciado)
    if campo.alineacion == "center":
        tx = x + (w - ancho) / 2
    elif campo.alineacion == "right":
        tx = x + w - ancho
    else:
        tx = x
    # Línea base centrada verticalmente en la caja
    ty = top - h / 2 - tam * 0.35
    c.setFillColorRGB(*_hex(campo.color))
    t = c.beginText(tx, ty)
    t.setFont(fuente, tam)
    t.setCharSpace(campo.espaciado)
    t.textOut(texto)
    c.drawText(t)


def _dibujar_casillas(c: canvas.Canvas, campo: Campo, texto: str, fuente: str, pw: float, ph: float) -> None:
    x = campo.x / 100 * pw
    w = campo.w / 100 * pw
    top = ph - campo.y / 100 * ph
    h = campo.h / 100 * ph
    celda = w / campo.casillas
    tam = min(campo.tam, celda * 1.1, h * 0.8)
    ty = top - h / 2 - tam * 0.35
    c.setFillColorRGB(*_hex(campo.color))
    for i, ch in enumerate(texto[: campo.casillas]):
        c.setFont(fuente, tam)
        c.drawCentredString(x + celda * i + celda / 2, ty, ch)


def _dibujar_qr(c: canvas.Canvas, campo: Campo, url: str, pw: float, ph: float) -> None:
    if not url:
        return
    img = qrcode.make(url, border=1, box_size=10).get_image()
    lado = min(campo.w / 100 * pw, campo.h / 100 * ph)
    x = campo.x / 100 * pw
    top = ph - campo.y / 100 * ph
    c.drawImage(ImageReader(img), x, top - lado, lado, lado)


def _dibujar_imagen(c: canvas.Canvas, campo: Campo, datos: Optional[bytes], pw: float, ph: float) -> None:
    """Firma dentro de su recuadro, sin deformarla: centrada y apoyada en la línea de abajo."""
    if not datos:
        return
    img = ImageReader(io.BytesIO(datos))
    iw, ih = img.getSize()
    bw, bh = campo.w / 100 * pw, campo.h / 100 * ph
    esc = min(bw / iw, bh / ih)
    w, h = iw * esc, ih * esc
    x = campo.x / 100 * pw + (bw - w) / 2
    y = ph - (campo.y + campo.h) / 100 * ph
    c.drawImage(img, x, y, w, h, mask="auto")


def _capa(campos: List[Campo], valores: Dict[str, str], pw: float, ph: float) -> Optional[bytes]:
    if not campos:
        return None
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(pw, ph))
    for campo in campos:
        if campo.clave == "qr":
            _dibujar_qr(c, campo, valores.get("qr", ""), pw, ph)
        elif campo.clave in IMAGENES:
            _dibujar_imagen(c, campo, valores.get(campo.clave), pw, ph)
        else:
            texto = campo.texto if campo.clave == "texto" else valores.get(campo.clave, "")
            _dibujar_texto(c, campo, texto, pw, ph)
    c.showPage()
    c.save()
    return buf.getvalue()


def generar(plantilla_pdf: bytes, campos_raw: List[Dict[str, Any]], lista_valores: List[Dict[str, str]]) -> bytes:
    """Un juego de páginas del formato por cada participante, todo en un solo PDF."""
    campos = [c for c in (Campo.desde(d) for d in campos_raw) if c]
    writer = PdfWriter()
    for valores in lista_valores:
        base = PdfReader(io.BytesIO(plantilla_pdf))
        for i, page in enumerate(base.pages):
            box = page.cropbox
            pw, ph = float(box.width), float(box.height)
            capa = _capa([c for c in campos if c.pagina == i], valores, pw, ph)
            if capa:
                overlay = PdfReader(io.BytesIO(capa)).pages[0]
                # La capa se dibuja en (0,0); se mueve al origen del cropbox de la página
                page.merge_transformed_page(overlay, Transformation().translate(float(box.left), float(box.bottom)))
            writer.add_page(page)
    out = io.BytesIO()
    writer.compress_identical_objects() if hasattr(writer, "compress_identical_objects") else None
    writer.write(out)
    return out.getvalue()
