from enum import StrEnum


class VerificationType(StrEnum):
    QR = "QR"
    LINK = "LINK"
    API = "API"


class VerificationResult(StrEnum):
    VALIDA = "VALIDA"
    REVOCADA = "REVOCADA"
    EXPIRADA = "EXPIRADA"
    NO_EXISTE = "NO_EXISTE"


class TimelineEventType(StrEnum):
    EMITIDA = "emitida"
    VERIFICADA = "verificada"
    CANCELADA = "cancelada"
    REEMITIDA = "reemitida"


class ConstanciaSort(StrEnum):
    FECHA = "fecha_emision"
    PARTICIPANTE = "participante"
    CURSO = "curso"
    ESTADO = "estado"


class OrderEnum(StrEnum):
    ASC = "asc"
    DESC = "desc"
