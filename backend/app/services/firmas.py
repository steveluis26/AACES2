"""Imágenes de firma para el DC-3.

Al subirla se limpia: fondo blanco -> transparente (así no tapa las líneas del
formato aunque venga de una foto o un escaneo), se recorta al trazo y se reduce.
"""
import io

from fastapi import HTTPException

MAX_BYTES = 3 * 1024 * 1024


def procesar(contenido: bytes) -> bytes:
    if len(contenido) > MAX_BYTES:
        raise HTTPException(400, "La imagen de la firma pesa más de 3 MB")
    from PIL import Image, ImageOps
    try:
        img = Image.open(io.BytesIO(contenido))
        img = ImageOps.exif_transpose(img).convert("RGBA")
    except Exception:
        raise HTTPException(400, "Sube la firma como imagen PNG o JPG")

    # Fondo claro -> transparente; el trazo conserva su color con opacidad según qué tan oscuro es
    datos = []
    for r, g, b, a in img.getdata():
        luz = (r + g + b) / 3
        if a == 0 or luz >= 225:
            datos.append((255, 255, 255, 0))
        else:
            opacidad = int(min(255, (225 - luz) * 255 / 120)) if luz > 105 else 255
            datos.append((r, g, b, min(a, opacidad)))
    img.putdata(datos)

    caja = img.getbbox()
    if not caja:
        raise HTTPException(400, "No encontramos el trazo de la firma. Usa una imagen con fondo claro y tinta oscura.")
    img = img.crop(caja)
    img.thumbnail((900, 400))
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def ejemplo() -> bytes:
    """Firma de muestra para la vista previa del editor."""
    from PIL import Image, ImageDraw
    import math
    img = Image.new("RGBA", (420, 140), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    puntos = [(20 + x, 80 + 38 * math.sin(x / 22) * math.cos(x / 61)) for x in range(0, 360, 3)]
    d.line(puntos, fill=(30, 45, 110, 255), width=4, joint="curve")
    d.line([(60, 118), (330, 104)], fill=(30, 45, 110, 255), width=3)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()
