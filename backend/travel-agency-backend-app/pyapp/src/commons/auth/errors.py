"""Standard authentication domain errors."""

from typing import Any, Dict, Optional


class AuthenticationError(Exception):
    """Base error for authentication and authorization failures."""

    status_code = 500
    error_code = "AUTHENTICATION_ERROR"
    default_message = "Authentication failed"

    def __init__(
        self,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.message = message or self.default_message
        self.details = details or {}

        super().__init__(self.message)

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "code": self.error_code,
            "message": self.message,
        }

        if self.details:
            body["details"] = self.details

        return body


class AuthenticationValidationError(AuthenticationError):
    status_code = 400
    error_code = "VALIDATION_ERROR"
    default_message = "Request validation failed"


class InvalidCredentialsError(AuthenticationError):
    status_code = 401
    error_code = "INVALID_CREDENTIALS"
    default_message = "Invalid email or password"


class UnauthorizedError(AuthenticationError):
    status_code = 401
    error_code = "UNAUTHORIZED"
    default_message = "Authentication is required"


class AuthenticationChallengeError(AuthenticationError):
    status_code = 401
    error_code = "AUTHENTICATION_CHALLENGE_REQUIRED"
    default_message = "Additional authentication step is required"


class UserNotConfirmedError(AuthenticationError):
    status_code = 403
    error_code = "USER_NOT_CONFIRMED"
    default_message = "User account is not confirmed"


class PasswordResetRequiredError(AuthenticationError):
    status_code = 403
    error_code = "PASSWORD_RESET_REQUIRED"
    default_message = "Password reset is required"


class ForbiddenError(AuthenticationError):
    status_code = 403
    error_code = "FORBIDDEN"
    default_message = "You are not allowed to access this resource"


class TooManyRequestsError(AuthenticationError):
    status_code = 429
    error_code = "TOO_MANY_REQUESTS"
    default_message = "Too many authentication attempts"


class AuthenticationServiceError(AuthenticationError):
    status_code = 503
    error_code = "AUTHENTICATION_SERVICE_UNAVAILABLE"
    default_message = "Authentication service is temporarily unavailable"

class InvalidConfirmationCodeError(
    AuthenticationError
):
    status_code = 400
    error_code = "INVALID_CONFIRMATION_CODE"
    default_message = (
        "Confirmation code is invalid"
    )


class ExpiredConfirmationCodeError(
    AuthenticationError
):
    status_code = 400
    error_code = "EXPIRED_CONFIRMATION_CODE"
    default_message = (
        "Confirmation code has expired"
    )


class PasswordPolicyViolationError(
    AuthenticationError
):
    status_code = 400
    error_code = "PASSWORD_POLICY_VIOLATION"
    default_message = (
        "New password does not meet the "
        "password policy"
    )


class EmailChangeNotAllowedError(
    AuthenticationError
):
    status_code = 400
    error_code = "EMAIL_CHANGE_NOT_ALLOWED"
    default_message = (
        "Email address cannot be changed"
    )

class EmailAlreadyInUseError(AuthenticationError):
    status_code = 400
    error_code = "EMAIL_ALREADY_IN_USE"
    default_message = "This email is already in use, please choose different one"

class EmailChangeNotPendingError(AuthenticationError):
    status_code = 409
    error_code = "EMAIL_CHANGE_NOT_PENDING"
    default_message = "No pending email change exists"

class EmailChangeResendCooldownError(AuthenticationError):
    status_code = 429
    error_code = "EMAIL_CHANGE_RESEND_COOLDOWN"
    default_message = "Please wait 60 seconds before requesting another code"
