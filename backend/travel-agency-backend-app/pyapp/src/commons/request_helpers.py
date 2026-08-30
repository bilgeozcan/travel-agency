from datetime import datetime

from commons.api_response import build_response


def _response(status_code, body, event=None):
    return build_response(status_code, body, event=event)


def _bad_request(message='Invalid input provided', errors=None):
    payload = {'message': message}
    if errors:
        payload['errors'] = errors
    return _response(400, payload)


def _parse_positive_int(value, field_name, minimum=1, maximum=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} must be an integer')

    if parsed < minimum:
        raise ValueError(f'{field_name} must be greater than or equal to {minimum}')
    if maximum is not None and parsed > maximum:
        raise ValueError(f'{field_name} must be less than or equal to {maximum}')
    return parsed


def _parse_non_negative_int(value, field_name):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} must be an integer')
    if parsed < 0:
        raise ValueError(f'{field_name} must be greater than or equal to 0')
    return parsed


def _parse_date(value, field_name):
    try:
        datetime.strptime(value, '%Y-%m-%d')
    except ValueError:
        raise ValueError(f'{field_name} must be in YYYY-MM-DD format')
    return value


def _normalize_str(value):
    if value is None:
        return ''
    return str(value).strip()
