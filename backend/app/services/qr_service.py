import io
import qrcode
from qrcode.image.svg import SvgPathImage


class QRService:

    async def generate(self, data: str) -> str:
        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(image_factory=SvgPathImage)
        buffer = io.BytesIO()
        img.save(buffer)
        return buffer.getvalue().decode("utf-8")


qr_service = QRService()
