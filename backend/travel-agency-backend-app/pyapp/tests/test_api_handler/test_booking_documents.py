import json
from decimal import Decimal
from unittest.mock import patch

from lambdas.api_handler import documents


def _principal(user_id='customer-1'):
    return {
        'sub': user_id,
        'user_id': user_id,
        'role': 'CUSTOMER',
    }


def _body(response):
    return json.loads(response['body'])


@patch('lambdas.api_handler.documents.s3_client')
@patch('lambdas.api_handler.documents.dynamodb')
def test_returns_document_metadata_for_booking_owner(mock_dynamodb, mock_s3_client):
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'documents': [
                {
                    'id': 'passport-1',
                    'name': 'Passport_Ada_Lovelace.pdf',
                    'fileFormat': 'PDF',
                    'documentType': 'PASSPORT',
                    'guestIndex': Decimal(1),
                    'storageKey': 'private/booking-1/passport-1',
                }
            ],
        }
    }

    response = documents.get_booking_documents(
        {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }
    )

    assert response['statusCode'] == 200
    assert _body(response) == {
        'documents': [
            {
                'id': 'passport-1',
                'name': 'Passport_Ada_Lovelace.pdf',
                'fileFormat': 'PDF',
                'documentType': 'PASSPORT',
                'guestIndex': 1,
            }
        ]
    }
    mock_s3_client.generate_presigned_url.assert_not_called()


@patch('lambdas.api_handler.documents.s3_client')
@patch('lambdas.api_handler.documents.dynamodb')
def test_omits_classification_for_documents_stored_without_it(mock_dynamodb, mock_s3_client):
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'documents': [
                {
                    'id': 'legacy-1',
                    'name': 'scan.pdf',
                    'fileFormat': 'PDF',
                    'storageKey': 'private/booking-1/legacy-1',
                }
            ],
        }
    }

    response = documents.get_booking_documents(
        {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }
    )

    assert response['statusCode'] == 200
    assert _body(response) == {
        'documents': [{'id': 'legacy-1', 'name': 'scan.pdf', 'fileFormat': 'PDF'}]
    }


@patch('lambdas.api_handler.documents.s3_client')
@patch('lambdas.api_handler.documents.dynamodb')
def test_returns_presigned_url_only_for_requested_document(mock_dynamodb, mock_s3_client):
    mock_s3_client.generate_presigned_url.return_value = (
        'https://documents.example.com/passport-1?signature=temporary'
    )
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'documents': [
                {
                    'id': 'passport-1',
                    'name': 'Passport_Ada_Lovelace.pdf',
                    'storageKey': 'bookings/booking-1/passport-1.pdf',
                }
            ],
        }
    }

    with patch.object(documents, 'DOCUMENTS_BUCKET', 'mock-documents-bucket'):
        response = documents.get_document_download_url(
            {
                'authenticatedUser': _principal(),
                'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
            }
        )

    assert response['statusCode'] == 200
    assert _body(response) == {
        'downloadUrl': 'https://documents.example.com/passport-1?signature=temporary'
    }
    mock_s3_client.generate_presigned_url.assert_called_once_with(
        'get_object',
        Params={
            'Bucket': 'mock-documents-bucket',
            'Key': 'bookings/booking-1/passport-1.pdf',
        },
        ExpiresIn=300,
    )


@patch('lambdas.api_handler.documents.dynamodb')
def test_hides_documents_for_another_customer(mock_dynamodb):
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {'id': 'booking-1', 'userId': 'customer-2'}
    }

    response = documents.get_booking_documents(
        {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }
    )

    assert response['statusCode'] == 404
    assert _body(response) == {
        'code': 'BOOKING_NOT_FOUND',
        'message': 'Booking not found',
    }


@patch('lambdas.api_handler.documents.dynamodb')
def test_returns_empty_documents_for_legacy_booking(mock_dynamodb):
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {'id': 'booking-1', 'userId': 'customer-1'}
    }

    response = documents.get_booking_documents(
        {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }
    )

    assert response['statusCode'] == 200
    assert _body(response) == {'documents': []}


@patch('lambdas.api_handler.documents.s3_client')
@patch('lambdas.api_handler.documents.dynamodb')
def test_customer_can_create_document_upload_url(mock_dynamodb, mock_s3_client):
    mock_s3_client.generate_presigned_url.return_value = 'https://documents.example.com/upload'
    table = mock_dynamodb.Table.return_value
    table.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'state': 'BOOKED',
        }
    }

    with patch.object(documents, 'DOCUMENTS_BUCKET', 'mock-documents-bucket'):
        response = documents.post_booking_document({
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
            'body': json.dumps({
                'name': 'Passport_Ada_Lovelace.pdf',
                'fileFormat': 'pdf',
                'contentType': 'application/pdf',
                'documentType': 'passport',
                'guestIndex': 1,
            }),
        })

    assert response['statusCode'] == 201
    body = _body(response)
    assert body['document']['name'] == 'Passport_Ada_Lovelace.pdf'
    assert body['document']['fileFormat'] == 'PDF'
    assert body['document']['documentType'] == 'PASSPORT'
    assert body['document']['guestIndex'] == 1
    assert body['uploadUrl'] == 'https://documents.example.com/upload'
    update_kwargs = table.update_item.call_args.kwargs
    stored_document = update_kwargs['ExpressionAttributeValues'][':document'][0]
    assert stored_document['name'] == 'Passport_Ada_Lovelace.pdf'
    assert stored_document['documentType'] == 'PASSPORT'
    assert stored_document['guestIndex'] == 1
    mock_s3_client.generate_presigned_url.assert_called_once()


@patch('lambdas.api_handler.documents.s3_client')
@patch('lambdas.api_handler.documents.dynamodb')
def test_upload_url_omits_classification_when_not_supplied(mock_dynamodb, mock_s3_client):
    mock_s3_client.generate_presigned_url.return_value = 'https://documents.example.com/upload'
    table = mock_dynamodb.Table.return_value
    table.get_item.return_value = {
        'Item': {'id': 'booking-1', 'userId': 'customer-1', 'state': 'BOOKED'}
    }

    with patch.object(documents, 'DOCUMENTS_BUCKET', 'mock-documents-bucket'):
        response = documents.post_booking_document({
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
            'body': json.dumps({
                'name': 'receipt.pdf',
                'fileFormat': 'pdf',
                'contentType': 'application/pdf',
            }),
        })

    assert response['statusCode'] == 201
    stored_document = table.update_item.call_args.kwargs[
        'ExpressionAttributeValues'
    ][':document'][0]
    assert 'documentType' not in stored_document
    assert 'guestIndex' not in stored_document


@patch('lambdas.api_handler.documents.dynamodb')
def test_upload_rejects_unknown_document_type(mock_dynamodb):
    response = documents.post_booking_document({
        'authenticatedUser': _principal(),
        'pathParameters': {'id': 'booking-1'},
        'body': json.dumps({
            'name': 'Passport.pdf',
            'fileFormat': 'PDF',
            'contentType': 'application/pdf',
            'documentType': 'VISA',
        }),
    })

    assert response['statusCode'] == 400
    assert 'documentType' in _body(response)['message']
    mock_dynamodb.Table.assert_not_called()


@patch('lambdas.api_handler.documents.dynamodb')
def test_upload_rejects_negative_guest_index(mock_dynamodb):
    response = documents.post_booking_document({
        'authenticatedUser': _principal(),
        'pathParameters': {'id': 'booking-1'},
        'body': json.dumps({
            'name': 'Passport.pdf',
            'fileFormat': 'PDF',
            'contentType': 'application/pdf',
            'documentType': 'PASSPORT',
            'guestIndex': -1,
        }),
    })

    assert response['statusCode'] == 400
    assert 'guestIndex' in _body(response)['message']
    mock_dynamodb.Table.assert_not_called()


@patch('lambdas.api_handler.documents.dynamodb')
def test_only_customers_can_upload_documents(mock_dynamodb):
    response = documents.post_booking_document({
        'authenticatedUser': {
            'sub': 'agent-1',
            'user_id': 'agent-1',
            'role': 'TRAVEL_AGENT',
        },
        'pathParameters': {'id': 'booking-1'},
        'body': json.dumps({
            'name': 'Passport.pdf',
            'fileFormat': 'PDF',
            'contentType': 'application/pdf',
        }),
    })

    assert response['statusCode'] == 403
    mock_dynamodb.Table.assert_not_called()


@patch('lambdas.api_handler.documents.dynamodb')
def test_customer_can_confirm_document_upload(mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {
            'Item': {
                'id': 'booking-1',
                'userId': 'customer-1',
                'documents': [
                    {
                        'id': 'passport-1',
                        'name': 'Passport_Ada_Lovelace.pdf',
                        'fileFormat': 'PDF',
                        'storageKey': 'bookings/booking-1/passport-1',
                    }
                ],
            }
        }

        response = documents.put_booking_document({
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
        })

        assert response['statusCode'] == 200
        body = _body(response)
        assert body['document']['id'] == 'passport-1'
        assert body['document']['name'] == 'Passport_Ada_Lovelace.pdf'
        assert body['document']['fileFormat'] == 'PDF'
        update_kwargs = table.update_item.call_args.kwargs
        updated_docs = update_kwargs['ExpressionAttributeValues'][':documents']
        assert updated_docs[0]['status'] == 'CONFIRMED'


@patch('lambdas.api_handler.documents.dynamodb')
def test_only_customers_can_confirm_documents(mock_dynamodb):
        response = documents.put_booking_document({
            'authenticatedUser': {
                'sub': 'agent-1',
                'user_id': 'agent-1',
                'role': 'TRAVEL_AGENT',
            },
            'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
        })

        assert response['statusCode'] == 403
        mock_dynamodb.Table.assert_not_called()


@patch('lambdas.api_handler.documents.dynamodb')
def test_confirm_document_is_idempotent(mock_dynamodb):
    table = mock_dynamodb.Table.return_value
    table.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'documents': [
                {
                    'id': 'passport-1',
                    'name': 'Passport.pdf',
                    'fileFormat': 'PDF',
                    'status': 'CONFIRMED',
                }
            ],
        }
    }

    response = documents.put_booking_document({
        'authenticatedUser': _principal(),
        'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
    })

    assert response['statusCode'] == 200
    body = _body(response)
    assert body['document']['id'] == 'passport-1'
    table.update_item.assert_not_called()


@patch('lambdas.api_handler.documents.s3_client')
@patch('lambdas.api_handler.documents.dynamodb')
def test_customer_can_delete_document(mock_dynamodb, mock_s3_client):
    table = mock_dynamodb.Table.return_value
    table.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'state': 'BOOKED',
            'documents': [
                {
                    'id': 'passport-1',
                    'name': 'Passport.pdf',
                    'fileFormat': 'PDF',
                    'storageKey': 'bookings/booking-1/passport-1',
                },
                {'id': 'confirmation-1', 'name': 'Confirmation.pdf'},
            ],
        }
    }

    with patch.object(documents, 'DOCUMENTS_BUCKET', 'mock-documents-bucket'):
        response = documents.delete_booking_document({
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
        })

    assert response['statusCode'] == 204
    update_kwargs = table.update_item.call_args.kwargs
    assert update_kwargs['ExpressionAttributeValues'][':documents'] == [
        {'id': 'confirmation-1', 'name': 'Confirmation.pdf'}
    ]
    mock_s3_client.delete_object.assert_called_once_with(
        Bucket='mock-documents-bucket',
        Key='bookings/booking-1/passport-1',
    )


@patch('lambdas.api_handler.documents.dynamodb')
def test_only_customers_can_delete_documents(mock_dynamodb):
    response = documents.delete_booking_document({
        'authenticatedUser': {
            'sub': 'agent-1',
            'user_id': 'agent-1',
            'role': 'TRAVEL_AGENT',
        },
        'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
    })

    assert response['statusCode'] == 403
    mock_dynamodb.Table.assert_not_called()


@patch('lambdas.api_handler.documents.dynamodb')
def test_delete_document_returns_not_found_for_unknown_document(mock_dynamodb):
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'state': 'BOOKED',
            'documents': [],
        }
    }

    response = documents.delete_booking_document({
        'authenticatedUser': _principal(),
        'pathParameters': {'id': 'booking-1', 'documentId': 'missing'},
    })

    assert response['statusCode'] == 404
    assert _body(response)['code'] == 'DOCUMENT_NOT_FOUND'


@patch('lambdas.api_handler.documents.dynamodb')
def test_delete_document_rejects_canceled_booking(mock_dynamodb):
    mock_dynamodb.Table.return_value.get_item.return_value = {
        'Item': {
            'id': 'booking-1',
            'userId': 'customer-1',
            'state': 'CANCELED',
            'documents': [{'id': 'passport-1', 'name': 'Passport.pdf'}],
        }
    }

    response = documents.delete_booking_document({
        'authenticatedUser': _principal(),
        'pathParameters': {'id': 'booking-1', 'documentId': 'passport-1'},
    })

    assert response['statusCode'] == 409
    assert _body(response)['code'] == 'BOOKING_STATE_CONFLICT'

@patch('lambdas.api_handler.documents.dynamodb')
def test_document_upload_requires_metadata(mock_dynamodb):
    response = documents.post_booking_document({
        'authenticatedUser': _principal(),
        'pathParameters': {'id': 'booking-1'},
        'body': json.dumps({'name': 'Passport.pdf'}),
    })

    assert response['statusCode'] == 400
    mock_dynamodb.Table.assert_not_called()