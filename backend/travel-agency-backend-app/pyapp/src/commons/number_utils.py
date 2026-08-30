import re
from decimal import Decimal


def to_number(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return 0.0

    raw = str(value).strip().replace(',', '')
    match = re.search(r'(\d+(?:\.\d+)?)', raw)
    if not match:
        return 0.0
    return float(match.group(1))
