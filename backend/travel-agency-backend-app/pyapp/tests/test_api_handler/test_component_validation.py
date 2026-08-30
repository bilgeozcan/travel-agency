import unittest
import importlib
from datetime import datetime, timedelta

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase


# Import the validation functions from handler module
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src'))

from lambdas.api_handler import handler


class TestFlightCapacityValidation(unittest.TestCase):
    """Test suite for _validate_flight_capacity function"""

    def test_valid_active_flight_with_sufficient_seats(self):
        """Test that active flight with sufficient seats passes validation"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=5)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_invalid_flight_with_insufficient_seats(self):
        """Test that flight with insufficient seats fails validation"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'seats': {
                'available': 2,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=5)
        
        self.assertFalse(is_valid)
        self.assertIn('Insufficient flight seats', error)
        self.assertIn('Required: 5', error)
        self.assertIn('Available: 2', error)

    def test_invalid_expired_flight(self):
        """Test that expired flight fails validation"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d'),
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Flight booking has expired')

    def test_invalid_inactive_flight(self):
        """Test that inactive flight fails validation"""
        flight_data = {
            'status': 'INACTIVE',
            'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertIn('Flight is inactive', error)

    def test_invalid_flight_data_structure(self):
        """Test that invalid flight data structure fails validation"""
        flight_data = None
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Flight data is invalid')

    def test_invalid_flight_expiry_date_format(self):
        """Test that invalid date format fails validation"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': '01-01-2025',  # Wrong format
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Invalid flight expiry date format')

    def test_flight_with_zero_available_seats(self):
        """Test that flight with zero available seats fails validation"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'seats': {
                'available': 0,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=1)
        
        self.assertFalse(is_valid)
        self.assertIn('Insufficient flight seats', error)

    def test_flight_status_case_insensitive(self):
        """Test that flight status check is case-insensitive"""
        flight_data = {
            'status': 'active',  # lowercase
            'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_flight_expiring_today_is_valid(self):
        """Edge Case: Test that flight expiring today is still valid (not affected by time)"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': datetime.now().strftime('%Y-%m-%d'),  # Tam bugün
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_flight_expiry_date_none(self):
        """Edge Case: Test that None expiryDate handles TypeError gracefully"""
        flight_data = {
            'status': 'ACTIVE',
            'expiryDate': None,
            'seats': {
                'available': 10,
                'total': 150
            }
        }
        is_valid, error = handler._validate_flight_capacity(flight_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Invalid flight expiry date format')



class TestAccommodationAvailabilityValidation(unittest.TestCase):
    """Test suite for _validate_accommodation_availability function"""

    def test_valid_available_accommodation_with_sufficient_capacity(self):
        """Test that available accommodation with sufficient capacity passes validation"""
        accommodation_data = {
            'status': 'ACTIVE',
            'capacity': 4,
            'availableRooms': 5,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=3)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_invalid_accommodation_exceeds_room_capacity(self):
        """Test that guest count exceeding room capacity fails validation"""
        accommodation_data = {
            'status': 'ACTIVE',
            'capacity': 2,
            'availableRooms': 5,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=3)
        
        self.assertFalse(is_valid)
        self.assertIn('Guest count exceeds room capacity', error)
        self.assertIn('Required: 3', error)
        self.assertIn('Capacity per room: 2', error)

    def test_invalid_fully_booked_accommodation(self):
        """Test that fully booked accommodation fails validation"""
        accommodation_data = {
            'status': 'FULLY_BOOKED',
            'capacity': 4,
            'availableRooms': 0,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Accommodation is fully booked')

    def test_invalid_accommodation_with_no_available_rooms(self):
        """Test that accommodation with no available rooms fails validation"""
        accommodation_data = {
            'status': 'ACTIVE',
            'capacity': 4,
            'availableRooms': 0,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'No available accommodation rooms')

    def test_invalid_inactive_accommodation(self):
        """Test that inactive accommodation fails validation"""
        accommodation_data = {
            'status': 'INACTIVE',
            'capacity': 4,
            'availableRooms': 5,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertIn('Accommodation is inactive', error)

    def test_invalid_accommodation_zero_capacity(self):
        """Test that accommodation with zero capacity fails validation"""
        accommodation_data = {
            'status': 'ACTIVE',
            'capacity': 0,
            'availableRooms': 5,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Accommodation capacity information is invalid')

    def test_invalid_accommodation_data_structure(self):
        """Test that invalid accommodation data structure fails validation"""
        accommodation_data = {}
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=2)
        
        self.assertFalse(is_valid)
        # Should fail on status check or capacity check
        self.assertIsNotNone(error)

    def test_accommodation_status_case_insensitive(self):
        """Test that accommodation status check is case-insensitive"""
        accommodation_data = {
            'status': 'active',  # lowercase
            'capacity': 4,
            'availableRooms': 5,
            'totalRooms': 20
        }
        is_valid, error = handler._validate_accommodation_availability(accommodation_data, guest_count=2)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)


class TestActivityStatusValidation(unittest.TestCase):
    """Test suite for _validate_activity_status function"""

    def test_valid_available_optional_activity(self):
        """Test that available optional activity passes validation"""
        activity_data = {
            'name': 'Snorkeling',
            'status': 'AVAILABLE',
            'isRequired': False,
            'maxParticipants': 20,
            'currentParticipants': 10
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_valid_available_required_activity(self):
        """Test that available required activity passes validation"""
        activity_data = {
            'name': 'Tour Guide',
            'status': 'AVAILABLE',
            'isRequired': True,
            'maxParticipants': 30,
            'currentParticipants': 15
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)

    def test_optional_cancelled_activity_returns_no_error(self):
        """Test that cancelled optional activity does not return error"""
        activity_data = {
            'name': 'Cancelled Tour',
            'status': 'CANCELLED',
            'isRequired': False,
            'maxParticipants': 20,
            'currentParticipants': 10
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertFalse(is_valid)
        self.assertIsNone(error)  # No error for optional

    def test_required_cancelled_activity_returns_error(self):
        """Test that cancelled required activity returns error"""
        activity_data = {
            'name': 'Main Event',
            'status': 'CANCELLED',
            'isRequired': True,
            'maxParticipants': 20,
            'currentParticipants': 10
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Main Event has been cancelled')

    def test_optional_fully_booked_activity_returns_no_error(self):
        """Test that fully booked optional activity does not return error"""
        activity_data = {
            'name': 'Optional Tour',
            'status': 'FULLY_BOOKED',
            'isRequired': False,
            'maxParticipants': 20,
            'currentParticipants': 20
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertFalse(is_valid)
        self.assertIsNone(error)  # No error for optional

    def test_required_fully_booked_activity_returns_error(self):
        """Test that fully booked required activity returns error"""
        activity_data = {
            'name': 'Mandatory Activity',
            'status': 'FULLY_BOOKED',
            'isRequired': True,
            'maxParticipants': 20,
            'currentParticipants': 20
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Mandatory Activity is fully booked')

    def test_invalid_activity_data_structure(self):
        """Test that invalid activity data structure fails validation"""
        activity_data = None
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertFalse(is_valid)
        self.assertEqual(error, 'Activity data is invalid')

    def test_activity_at_max_capacity(self):
        """Test that activity at max capacity fails when currentParticipants equals maxParticipants"""
        activity_data = {
            'name': 'Hiking Tour',
            'status': 'AVAILABLE',
            'isRequired': False,
            'maxParticipants': 20,
            'currentParticipants': 20  # At capacity
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        # Should return False with no error for optional activities at capacity
        self.assertFalse(is_valid)
        self.assertIsNone(error)

    def test_activity_status_case_insensitive(self):
        """Test that activity status check is case-insensitive"""
        activity_data = {
            'name': 'Beach Tour',
            'status': 'available',  # lowercase
            'isRequired': False,
            'maxParticipants': 20,
            'currentParticipants': 10
        }
        is_valid, error = handler._validate_activity_status(activity_data)
        
        self.assertTrue(is_valid)
        self.assertIsNone(error)


class TestTourComponentsAggregation(unittest.TestCase):
    """Test suite for _validate_tour_components aggregator function"""

    def test_valid_all_components(self):
        """Test that all valid components pass aggregation validation"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 5,
                    'totalRooms': 20
                },
                'activities': [
                    {
                        'name': 'Snorkeling',
                        'status': 'AVAILABLE',
                        'isRequired': False,
                        'maxParticipants': 20,
                        'currentParticipants': 10
                    }
                ]
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=3)
        
        self.assertTrue(is_valid)
        self.assertIsNone(errors['flight'])
        self.assertIsNone(errors['accommodation'])
        self.assertIsNone(errors['activities'])

    def test_invalid_flight_in_components(self):
        """Test that invalid flight is captured in aggregated errors"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 5,
                    'totalRooms': 20
                },
                'activities': []
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(errors['flight'], 'Flight booking has expired')
        self.assertIsNone(errors['accommodation'])
        self.assertIsNone(errors['activities'])

    def test_invalid_accommodation_in_components(self):
        """Test that invalid accommodation is captured in aggregated errors"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'FULLY_BOOKED',
                    'capacity': 4,
                    'availableRooms': 0,
                    'totalRooms': 20
                },
                'activities': []
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertIsNone(errors['flight'])
        self.assertEqual(errors['accommodation'], 'Accommodation is fully booked')
        self.assertIsNone(errors['activities'])

    def test_invalid_required_activity_in_components(self):
        """Test that invalid required activity is captured in aggregated errors"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 5,
                    'totalRooms': 20
                },
                'activities': [
                    {
                        'name': 'Main Tour',
                        'status': 'CANCELLED',
                        'isRequired': True,
                        'maxParticipants': 20,
                        'currentParticipants': 10
                    }
                ]
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertIsNone(errors['flight'])
        self.assertIsNone(errors['accommodation'])
        self.assertIsNotNone(errors['activities'])
        self.assertEqual(len(errors['activities']), 1)
        self.assertEqual(errors['activities'][0]['name'], 'Main Tour')
        self.assertEqual(errors['activities'][0]['error'], 'Main Tour has been cancelled')

    def test_multiple_invalid_activities(self):
        """Test that multiple invalid activities are all captured"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 5,
                    'totalRooms': 20
                },
                'activities': [
                    {
                        'name': 'Cancelled Activity',
                        'status': 'CANCELLED',
                        'isRequired': True,
                        'maxParticipants': 20,
                        'currentParticipants': 10
                    },
                    {
                        'name': 'Fully Booked Activity',
                        'status': 'FULLY_BOOKED',
                        'isRequired': True,
                        'maxParticipants': 20,
                        'currentParticipants': 20
                    }
                ]
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(errors['activities'])
        self.assertEqual(len(errors['activities']), 2)

    def test_missing_flight_component(self):
        """Test that missing flight component is captured in errors"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 5,
                    'totalRooms': 20
                },
                'activities': []
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(errors['flight'], 'Flight information is missing')

    def test_missing_accommodation_component(self):
        """Test that missing accommodation component is captured in errors"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'activities': []
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertEqual(errors['accommodation'], 'Accommodation information is missing')

    def test_multiple_component_errors(self):
        """Test that all component errors are aggregated together"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'INACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'FULLY_BOOKED',
                    'capacity': 4,
                    'availableRooms': 0,
                    'totalRooms': 20
                },
                'activities': [
                    {
                        'name': 'Cancelled Activity',
                        'status': 'CANCELLED',
                        'isRequired': True,
                        'maxParticipants': 20,
                        'currentParticipants': 10
                    }
                ]
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertFalse(is_valid)
        self.assertIsNotNone(errors['flight'])
        self.assertIsNotNone(errors['accommodation'])
        self.assertIsNotNone(errors['activities'])

    def test_optional_activities_not_in_errors_when_valid(self):
        """Test that optional activities don't appear in errors when valid"""
        tour_data = {
            'id': 'tour-1',
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                    'seats': {'available': 10, 'total': 150}
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 5,
                    'totalRooms': 20
                },
                'activities': [
                    {
                        'name': 'Optional Activity',
                        'status': 'CANCELLED',
                        'isRequired': False,
                        'maxParticipants': 20,
                        'currentParticipants': 10
                    }
                ]
            }
        }
        is_valid, errors = handler._validate_tour_components(tour_data, guest_count=2)
        
        self.assertTrue(is_valid)  # Should still be valid since activity is optional
        self.assertIsNone(errors['activities'])


if __name__ == '__main__':
    unittest.main()
