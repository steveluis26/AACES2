class DomainError(Exception):
    """Base exception for domain errors."""
    pass


class InvalidCredentialsError(DomainError):
    """Invalid email or password."""
    pass


class UserInactiveError(DomainError):
    """User account is inactive."""
    pass


class OrganizationPendingError(DomainError):
    """Organization is pending activation."""
    pass


class OrganizationSuspendedError(DomainError):
    """Organization has been suspended."""
    pass


class AccountBlockedError(DomainError):
    """User account is temporarily blocked."""
    pass


class ResourceNotFoundError(DomainError):
    """Requested resource was not found."""
    pass


class BusinessRuleViolation(DomainError):
    """A business rule was violated."""
    pass
