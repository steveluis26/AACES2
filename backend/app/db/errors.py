from typing import Optional
from sqlalchemy.exc import ProgrammingError


def get_sqlstate(exc: ProgrammingError) -> Optional[str]:
    current: object = exc
    for _ in range(5):
        if hasattr(current, "sqlstate"):
            state = getattr(current, "sqlstate", None)
            if state is not None:
                return str(state)
        orig = getattr(current, "orig", None)
        if orig is None or orig is current:
            break
        current = orig
    return None


def is_undefined_table(exc: ProgrammingError) -> bool:
    return get_sqlstate(exc) == "42P01"


def is_unique_violation(exc: ProgrammingError) -> bool:
    return get_sqlstate(exc) == "23505"


def is_fk_violation(exc: ProgrammingError) -> bool:
    return get_sqlstate(exc) == "23503"
