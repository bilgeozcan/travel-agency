import json
import unittest
from decimal import Decimal

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    import importlib
    api_response_module = importlib.import_module('commons.api_response')
    build_response = api_response_module.build_response

class TestDecimalSerialization(unittest.TestCase):
    """Tests for DynamoDB Decimal handling in build_response"""

    def test_integer_decimal_serialized_as_int(self):
        response = build_response(200, {'adultsMaxValue': Decimal('4')})
        self.assertEqual(json.loads(response['body'])['adultsMaxValue'], 4)

    def test_fractional_decimal_serialized_as_float(self):
        response = build_response(200, {'rating': Decimal('4.5')})
        self.assertEqual(json.loads(response['body'])['rating'], 4.5)

    def test_nested_decimal_serialized(self):
        body = {
            'guestQuantity': {'adultsMaxValue': Decimal('4'), 'totalMaxValue': Decimal('6')},
            'ratings': [Decimal('4.9'), Decimal('5')]
        }
        parsed = json.loads(build_response(200, body)['body'])
        self.assertEqual(parsed['guestQuantity']['adultsMaxValue'], 4)
        self.assertEqual(parsed['guestQuantity']['totalMaxValue'], 6)
        self.assertEqual(parsed['ratings'], [4.9, 5])


if __name__ == '__main__':
    unittest.main()