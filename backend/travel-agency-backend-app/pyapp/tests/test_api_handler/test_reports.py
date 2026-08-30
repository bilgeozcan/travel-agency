import json
import os
import time
import unittest
from unittest.mock import patch, MagicMock

# Set environment variables before importing the handler
os.environ['region'] = 'eu-west-3'
os.environ['reports_table'] = 'mock-reports-table'
os.environ['report_cache_table'] = 'mock-report-cache'
os.environ['reports_bucket'] = 'mock-reports-bucket'

from lambdas.api_handler.reports import generate_report, download_report

class TestReports(unittest.TestCase):

    def test_generate_report_missing_inputs(self):
        """Test POST /reports/generate with missing fields returns 400."""
        event = {'body': json.dumps({'reportType': 'SALES'})} 
        
        response = generate_report(event)
        
        self.assertEqual(response['statusCode'], 400)
        self.assertIn('Validation failed', response['body'])

    def test_generate_report_invalid_type(self):
        """Test POST /reports/generate with an invalid reportType returns 400."""
        event = {
            'body': json.dumps({
                'reportType': 'INVALID_TYPE',
                'startDate': '2025-01-15',
                'endDate': '2025-01-22',
                'location': 'Punta Cana, Dominican Republic'
            })
        }
        
        response = generate_report(event)
        self.assertEqual(response['statusCode'], 400)

    @patch('lambdas.api_handler.reports.dynamodb')
    def test_generate_report_success(self, mock_dynamodb):
        """Test POST /reports/generate succeeds, returns schema, and caches data."""
        # 1. Setup the mock DynamoDB table and its response
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        
        # Mock the US_10 query response
        mock_table.query.return_value = {
            'Items': [{
                "period": "2025-01-13",
                "sortKey": "SALES_STATISTICS#punta cana, dominican republic",
                "reportType": "SALES_STATISTICS",
                "toursCount": 254,
                "revenue": 472650,
                "rating1Count": 0,
                "rating2Count": 0,
                "rating3Count": 10,
                "rating4Count": 40,
                "rating5Count": 100
            }]
        }

        event = {
            'body': json.dumps({
                'reportType': 'SALES',
                'startDate': '2025-01-15',
                'endDate': '2025-01-22',
                'location': 'Punta Cana, Dominican Republic'
            })
        }
        
        response = generate_report(event)
        
        # 2. Assertions
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('cachedReportKey', body)
        self.assertEqual(body['reportType'], 'SALES')
        
        # Verify put_item was called on the cache table
        mock_table.put_item.assert_called_once()
        put_args = mock_table.put_item.call_args[1]['Item']
        self.assertEqual(put_args['reportType'], 'SALES')

    def test_download_report_missing_params(self):
        """Test GET /reports/download with missing params returns 400."""
        event = {'queryStringParameters': {'format': 'pdf'}}
        
        response = download_report(event)
        self.assertEqual(response['statusCode'], 400)

    @patch('lambdas.api_handler.reports.dynamodb')
    def test_download_report_not_found(self, mock_dynamodb):
        """Test GET /reports/download with invalid key returns 404."""
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {} # Simulate empty response
        
        event = {
            'queryStringParameters': {
                'cachedReportKey': 'non-existent-key',
                'format': 'pdf'
            }
        }
        
        response = download_report(event)
        self.assertEqual(response['statusCode'], 404)

    @patch('lambdas.api_handler.reports.dynamodb')
    def test_download_report_expired(self, mock_dynamodb):
        """Test GET /reports/download with an expired TTL returns 404."""
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {
            'Item': {
                'id': 'expired-key',
                'ttl': int(time.time()) - 3600, # 1 hour in the past
                'reportData': {}
            }
        }
        
        event = {
            'queryStringParameters': {
                'cachedReportKey': 'expired-key',
                'format': 'csv'
            }
        }
        
        response = download_report(event)
        self.assertEqual(response['statusCode'], 404)

    @patch('lambdas.api_handler.reports.s3_client')
    @patch('lambdas.api_handler.reports.dynamodb')
    def test_download_report_success(self, mock_dynamodb, mock_s3_client):
        """Test GET /reports/download succeeds and returns a presigned URL."""
        # 1. Setup Mock DynamoDB Cache
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {
            'Item': {
                'id': 'valid-key',
                'ttl': int(time.time()) + 3600,
                'reportData': {
                    'columns': ['Col1', 'Col2'],
                    'rows': [[1, 2]]
                }
            }
        }

        # 2. Setup Mock S3 Client
        mock_s3_client.generate_presigned_url.return_value = "https://mock-reports-bucket.s3.amazonaws.com/report_valid-key.csv?signature=abc"

        event = {
            'queryStringParameters': {
                'cachedReportKey': 'valid-key',
                'format': 'csv'
            }
        }
        
        response = download_report(event)
        
        # 3. Assertions
        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        
        # Verify S3 upload and URL generation were triggered
        mock_s3_client.put_object.assert_called_once()
        mock_s3_client.generate_presigned_url.assert_called_once()
        
        self.assertEqual(body['fileUrl'], "https://mock-reports-bucket.s3.amazonaws.com/report_valid-key.csv?signature=abc")

if __name__ == '__main__':
    unittest.main()