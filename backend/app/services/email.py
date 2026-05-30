import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.EMAIL_FROM
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None
    ) -> bool:
        """Send email with optional HTML content."""
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = to_email
            
            # Add text part
            text_part = MIMEText(body, "plain")
            msg.attach(text_part)
            
            # Add HTML part if provided
            if html_body:
                html_part = MIMEText(html_body, "html")
                msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_welcome_email(self, to_email: str, nombre: str) -> bool:
        """Send welcome email to new cliente."""
        subject = "Bienvenido a AACES - Sistema de Gestión de Capacitaciones"
        body = f"""
        Estimado/a {nombre},
        
        ¡Bienvenido a AACES! Nos complace tenerle como parte de nuestra comunidad.
        
        Su cuenta ha sido creada exitosamente. Ahora puede:
        - Acceder a nuestros cursos de capacitación
        - Inscribir participantes
        - Generar certificados
        - Realizar seguimiento de pagos
        
        Para cualquier consulta, no dude en contactarnos.
        
        Atentamente,
        El equipo de AACES
        """
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2c5aa0;">¡Bienvenido a AACES!</h2>
            <p>Estimado/a <strong>{nombre}</strong>,</p>
            <p>¡Nos complace tenerle como parte de nuestra comunidad!</p>
            <p>Su cuenta ha sido creada exitosamente. Ahora puede:</p>
            <ul>
                <li>Acceder a nuestros cursos de capacitación</li>
                <li>Inscribir participantes</li>
                <li>Generar certificados</li>
                <li>Realizar seguimiento de pagos</li>
            </ul>
            <p>Para cualquier consulta, no dude en contactarnos.</p>
            <p>Atentamente,<br>El equipo de AACES</p>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, body, html_body)
    
    def send_certificate_email(
        self,
        to_email: str,
        participante_nombre: str,
        curso_titulo: str,
        codigo_validacion: str
    ) -> bool:
        """Send certificate notification email."""
        subject = f"Certificado Disponible - {curso_titulo}"
        body = f"""
        Estimado/a {participante_nombre},
        
        Nos complace informarle que su certificado para el curso "{curso_titulo}" está disponible.
        
        Puede validar su certificado usando el siguiente código:
        {codigo_validacion}
        
        Para validar su certificado, visite nuestra página de validación pública.
        
        ¡Felicitaciones por completar el curso!
        
        Atentamente,
        El equipo de AACES
        """
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2c5aa0;">¡Certificado Disponible!</h2>
            <p>Estimado/a <strong>{participante_nombre}</strong>,</p>
            <p>Nos complace informarle que su certificado para el curso <strong>"{curso_titulo}"</strong> está disponible.</p>
            <div style="background-color: #f0f8ff; padding: 15px; border-left: 4px solid #2c5aa0; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2c5aa0;">Código de Validación:</h3>
                <p style="font-size: 18px; font-weight: bold; font-family: monospace; background-color: #e8f4fd; padding: 10px; border-radius: 5px;">
                    {codigo_validacion}
                </p>
            </div>
            <p>Para validar su certificado, visite nuestra página de validación pública.</p>
            <p>¡Felicitaciones por completar el curso!</p>
            <p>Atentamente,<br>El equipo de AACES</p>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, body, html_body)

# Create singleton instance
email_service = EmailService()