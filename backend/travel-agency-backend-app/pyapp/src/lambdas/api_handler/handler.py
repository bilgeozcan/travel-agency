from copy import deepcopy
from typing import Any, Dict, Optional, Tuple

from commons.abstract_lambda import AbstractLambda
from commons.api_response import build_response
from commons.auth.errors import AuthenticationError, ForbiddenError
from commons.auth.authorization import require_roles
from commons.auth.user_context import get_authenticated_user
try:
    from lambdas.api_handler.refresh import handle_refresh
except ImportError:
    from refresh import handle_refresh

from commons.log_helper import get_logger

try:
    from lambdas.api_handler.forgot_password import (
        handle_confirm_forgot_password,
        handle_forgot_password,
    )
except ImportError:
    from forgot_password import (
        handle_confirm_forgot_password,
        handle_forgot_password,
    )

try:
    from lambdas.api_handler.verify_code import handle_verify_code
except ImportError:
    from verify_code import handle_verify_code

try:
    from lambdas.api_handler.reset_password import handle_reset_password
except ImportError:
    from reset_password import handle_reset_password

try:
    from sign_in import handle_sign_in
except ImportError:
    from lambdas.api_handler.sign_in import handle_sign_in

try:
    from sign_out import handle_sign_out
except ImportError:
    from lambdas.api_handler.sign_out import handle_sign_out

try:
    from tours import get_tour_details, get_tour_reviews
except ImportError:
    from lambdas.api_handler.tours import get_tour_details, get_tour_reviews

try:
    from lambdas.api_handler.tour_search import get_available_tours, get_tour_destinations
except ImportError:
    from tour_search import get_available_tours, get_tour_destinations

try:
    from lambdas.api_handler.booking_validate import (
        validate_booking_availability,
        _validate_flight_capacity,
        _validate_accommodation_availability,
        _validate_activity_status,
        _validate_tour_components,
    )
except ImportError:
    from booking_validate import (
        validate_booking_availability,
        _validate_flight_capacity,
        _validate_accommodation_availability,
        _validate_activity_status,
        _validate_tour_components,
    )

try:
    # alias kept for backward-compat test contract (LAMBDA_HANDLER.signup / handler.signup)
    from lambdas.api_handler.signup import handle_signup as signup
except ImportError:
    from signup import handle_signup as signup
try:
    from lambdas.api_handler.bookings import create_booking, get_bookings, edit_booking, cancel_booking, confirm_booking, reject_documents, confirm_edit, decline_edit
except ImportError:
    from bookings import create_booking, get_bookings, edit_booking, cancel_booking, confirm_booking, reject_documents, confirm_edit, decline_edit
try:
    from lambdas.api_handler.documents import get_booking_documents, get_document_download_url, post_booking_document
except ImportError:
    from documents import get_booking_documents, get_document_download_url, post_booking_document
try:
    from lambdas.api_handler.documents import put_booking_document
except ImportError:
    from documents import put_booking_document
try:
    from lambdas.api_handler.documents import delete_booking_document
except ImportError:
    from documents import delete_booking_document
try:
    from lambdas.api_handler.profile import handle_get_profile, handle_update_profile
except ImportError:
    from profile import handle_get_profile, handle_update_profile

try:
    from lambdas.api_handler.account_security import (
        handle_change_password, handle_initiate_email_change,
        handle_confirm_email_change, handle_resend_email_change,
    )
except ImportError:
    from account_security import (
        handle_change_password, handle_initiate_email_change,
        handle_confirm_email_change, handle_resend_email_change,
    )

try:
    from lambdas.api_handler.feedback import handle_feedback_submission
except ImportError:
    from feedback import handle_feedback_submission

try:
    from lambdas.api_handler.reports import generate_report, download_report
except ImportError:
    from reports import generate_report, download_report

_LOG = get_logger(__name__)

PROTECTED_ROUTES = {
    ("GET", "/profile"),
    ("PUT", "/profile"),
    ("POST", "/profile/change-password"),
    ("POST", "/profile/email-change"),
    ("POST", "/profile/email-change/confirm"),
    ("POST", "/profile/email-change/resend"),
    ("GET", "/bookings"),
    ("POST", "/bookings"),
    ("GET", "/bookings/{id}/documents"),
    ("POST", "/bookings/{id}/documents"),
    ("GET", "/bookings/{id}/documents/{documentId}/download-url"),
    ("PUT", "/bookings/{id}/documents/{documentId}"),
    ("DELETE", "/bookings/{id}/documents/{documentId}"),
    ("POST", "/bookings/validate"),
    ("PUT", "/bookings/{id}"),
    ("DELETE", "/bookings/{id}"),
    ("POST", "/bookings/{id}/confirm"),
    ("POST", "/bookings/{id}/reject-documents"),
    ("POST", "/bookings/{id}/confirm-edit"),
    ("POST", "/bookings/{id}/decline-edit"),
    ("POST", "/tours/{id}/feedbacks"),
    ("PUT", "/tours/{id}/feedbacks"),
    ("POST", "/reports/generate"),
    ("GET", "/reports/download"),
}


def _get_route(event: Dict[str, Any]) -> Tuple[str, str]:
    if not isinstance(event, dict):
        return "", ""

    method = str(event.get("httpMethod") or "").upper()
    path = event.get("resource") or event.get("path") or ""
    return method, path


def _mask_authorization_headers(event: Dict[str, Any]) -> Dict[str, Any]:
    safe_event = deepcopy(event)

    headers = safe_event.get("headers")
    if isinstance(headers, dict):
        for key in list(headers):
            if key.lower() == "authorization":
                headers[key] = "***"

    multi_value_headers = safe_event.get("multiValueHeaders")
    if isinstance(multi_value_headers, dict):
        for key in list(multi_value_headers):
            if key.lower() == "authorization":
                multi_value_headers[key] = ["***"]

    return safe_event


def _extract_bearer_token(event: Dict[str, Any]) -> Optional[str]:
    headers = event.get("headers") or {}
    value = next((v for k, v in headers.items() if isinstance(k, str) and k.lower() == "authorization"), "")
    if isinstance(value, str) and value.startswith("Bearer ") and value[7:].strip():
        return value[7:].strip()
    return None


def _attach_authenticated_user(event: Dict[str, Any]) -> Dict[str, Any]:
    user = get_authenticated_user(event)
    raw_token = _extract_bearer_token(event)
    safe_event = _mask_authorization_headers(event)
    if raw_token:
        safe_event["accessToken"] = raw_token
    safe_event["authenticatedUser"] = user

    request_context = safe_event.get("requestContext")
    if not isinstance(request_context, dict):
        request_context = {}
        safe_event["requestContext"] = request_context

    request_context["authenticatedUser"] = user
    return safe_event

class ApiHandler(AbstractLambda):

    def validate_request(self, event) -> dict:
        pass

    def handle_request(self, event, context):
        request_path = event.get('resource', '')
        http_method = event.get('httpMethod', '')

        if request_path == '/auth/sign-up' and http_method == 'POST':
            return signup(event)
        if request_path == '/tours/destinations' and http_method == 'GET':
            return get_tour_destinations(event)
        if request_path == '/tours/available' and http_method == 'GET':
            return get_available_tours(event)
        if request_path == '/profile' and http_method == 'PUT':
            return handle_update_profile(event)
        if request_path == '/profile' and http_method == 'GET':
            return handle_get_profile(event)
        if request_path == '/profile/change-password' and http_method == 'POST':
            return handle_change_password(event)
        if request_path == '/profile/email-change' and http_method == 'POST':
            return handle_initiate_email_change(event)
        if request_path == '/profile/email-change/confirm' and http_method == 'POST':
            return handle_confirm_email_change(event)
        if request_path == '/profile/email-change/resend' and http_method == 'POST':
            return handle_resend_email_change(event)
        if request_path == '/bookings' and http_method == 'POST':
            return create_booking(event)
        if request_path == '/bookings' and http_method == 'GET':
            return get_bookings(event)
        if request_path == '/bookings/{id}/documents' and http_method == 'GET':
            return get_booking_documents(event)
        if request_path == '/bookings/{id}/documents' and http_method == 'POST':
            return post_booking_document(event)
        if request_path == '/bookings/{id}/documents/{documentId}/download-url' and http_method == 'GET':
            return get_document_download_url(event)
        if request_path == '/bookings/{id}' and http_method == 'PUT':
            return edit_booking(event)
        if request_path == '/bookings/{id}/documents/{documentId}' and http_method == 'PUT':
            return put_booking_document(event)
        if request_path == '/bookings/{id}/documents/{documentId}' and http_method == 'DELETE':
            return delete_booking_document(event)
        if request_path == '/bookings/{id}' and http_method == 'DELETE':
            return cancel_booking(event)
        if request_path == '/bookings/{id}/confirm' and http_method == 'POST':
            return confirm_booking(event)
        if request_path == '/bookings/{id}/reject-documents' and http_method == 'POST':
            return reject_documents(event)
        if request_path == '/bookings/{id}/confirm-edit' and http_method == 'POST':
            return confirm_edit(event)
        if request_path == '/bookings/{id}/decline-edit' and http_method == 'POST':
            return decline_edit(event)
        if request_path == '/bookings/validate' and http_method == 'POST':
            return validate_booking_availability(event)
        if request_path == '/tours/{id}' and http_method == 'GET':
            return get_tour_details(event)
        if request_path == '/tours/{id}/reviews' and http_method == 'GET':
            return get_tour_reviews(event)
        if request_path == '/tours/{id}/feedbacks' and http_method == 'POST':
            return handle_feedback_submission(event)
        if request_path == '/tours/{id}/feedbacks' and http_method == 'PUT':
            return handle_feedback_submission(event)
        if request_path == '/reports/generate' and http_method == 'POST':
            return generate_report(event)
        if request_path == '/reports/download' and http_method == 'GET':
            return download_report(event)
            
        return build_response(400, {'message': 'Unknown request path'}, event=event)


HANDLER = ApiHandler()


def lambda_handler(event, context):
    method, path = _get_route(event)

    if method == "OPTIONS":
        return build_response(200, {}, event=event)

    if (
        method == "POST"
        and path == "/auth/forgot-password"
    ):
        return handle_forgot_password(event)

    if (
        method == "POST"
        and path == "/auth/verify-code"
    ):
        return handle_verify_code(event)

    if (
        method == "POST"
        and path == "/auth/reset-password"
    ):
        return handle_reset_password(event)

    if (
        method == "POST"
        and path == "/auth/confirm-forgot-password"
    ):
        return handle_confirm_forgot_password(event)

    if method == "POST" and path == "/auth/sign-in":
        return handle_sign_in(event)

    if method == "POST" and path == "/auth/refresh":
        return handle_refresh(event)

    if method == "POST" and path == "/auth/sign-out":
        return handle_sign_out(event)

    if (method, path) in PROTECTED_ROUTES:
        try:
            event = _attach_authenticated_user(event)
            if path.startswith("/reports"):
                require_roles(event, ["ADMIN"])
            else:
                require_roles(event, ["CUSTOMER", "TRAVEL_AGENT", "ADMIN"])
        except (AuthenticationError, ForbiddenError) as exc:
            _LOG.warning(
                "Protected request rejected: %s",
                exc.error_code,
            )
            return build_response(
                exc.status_code,
                exc.to_body(),
                event=event,
            )

    return HANDLER.lambda_handler(event=event, context=context)