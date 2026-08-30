from typing import Any, Dict, List
from commons.auth.errors import ForbiddenError

def require_roles(event: Dict[str, Any], allowed_roles: List[str]) -> None:
    """
    Checks if the authenticated user has one of the allowed roles.
    Raises ForbiddenError if the user does not have permission.
    """
    auth_user = event.get("authenticatedUser")
    if not auth_user:
        raise ForbiddenError("Authentication context is missing.")
        
    user_role = auth_user.get("role")
    
    if not user_role or user_role not in allowed_roles:
        raise ForbiddenError(f"Role '{user_role}' is not authorized to perform this action.")
