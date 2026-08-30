import os
import json
import uuid

import boto3
from botocore.client import Config

from commons.api_response import build_response
from commons.log_helper import get_logger

try:
    from lambdas.api_handler.bookings import _booking_not_found_response, _can_access_booking
except ImportError:
    from bookings import _booking_not_found_response, _can_access_booking


_LOG = get_logger(__name__)
REGION = os.environ.get('region', 'eu-west-3')
BOOKINGS_TABLE = os.environ.get('bookings_table')
DOCUMENTS_BUCKET = os.environ.get('documents_bucket')

dynamodb = boto3.resource('dynamodb', region_name=REGION)
s3_client = boto3.client(
    's3',
    region_name=REGION,
    endpoint_url=f'https://s3.{REGION}.amazonaws.com',
    config=Config(signature_version='s3v4', s3={'addressing_style': 'virtual'}),
)

_ALLOWED_UPLOAD_STATES = {'BOOKED', 'CONFIRMED'}
_MAX_DOCUMENT_NAME_LENGTH = 255
_MAX_FILE_FORMAT_LENGTH = 20
_ALLOWED_DOCUMENT_TYPES = {'PASSPORT', 'PAYMENT_CONFIRMATION'}


def _public_document(document):
    """Project a stored document onto the fields safe to return to clients.

    documentType/guestIndex are optional: documents stored before classification
    was introduced simply omit them, and the client groups those separately.
    """
    public_document = {
        'id': str(document.get('id') or ''),
        'name': str(document.get('name') or ''),
    }
    if document.get('fileFormat') is not None:
        public_document['fileFormat'] = str(document['fileFormat'])
    if document.get('documentType') is not None:
        public_document['documentType'] = str(document['documentType'])
    if document.get('guestIndex') is not None:
        # DynamoDB returns numbers as Decimal, which is not JSON-serializable.
        public_document['guestIndex'] = int(document['guestIndex'])
    return public_document


def post_booking_document(event):
    """POST /bookings/{id}/documents - Create a presigned document upload URL."""
    booking_id = (event.get('pathParameters') or {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'}, event=event)

    principal = event.get('authenticatedUser') or {}
    if not isinstance(principal, dict) or str(principal.get('role') or '').upper() != 'CUSTOMER':
        return build_response(
            403,
            {'code': 'FORBIDDEN', 'message': 'Only customers can upload documents'},
            event=event,
        )

    try:
        body = json.loads(event.get('body') or '{}')
    except (TypeError, ValueError):
        return build_response(400, {'message': 'Invalid JSON body'}, event=event)

    name = str(body.get('name') or '').strip()
    file_format = str(body.get('fileFormat') or '').strip().upper()
    content_type = str(body.get('contentType') or '').strip()
    if not name or len(name) > _MAX_DOCUMENT_NAME_LENGTH:
        return build_response(
            400,
            {'message': f'name is required and must be at most {_MAX_DOCUMENT_NAME_LENGTH} characters'},
            event=event,
        )
    if not file_format or len(file_format) > _MAX_FILE_FORMAT_LENGTH:
        return build_response(
            400,
            {'message': f'fileFormat is required and must be at most {_MAX_FILE_FORMAT_LENGTH} characters'},
            event=event,
        )
    if not content_type or '/' not in content_type:
        return build_response(400, {'message': 'contentType is required'}, event=event)

    # documentType/guestIndex are optional so older clients keep working, but
    # when supplied they must be valid — the customer UI relies on them to show
    # each document against the guest it belongs to.
    document_type = body.get('documentType')
    if document_type is not None:
        document_type = str(document_type).strip().upper()
        if document_type not in _ALLOWED_DOCUMENT_TYPES:
            return build_response(
                400,
                {
                    'message': 'documentType must be one of '
                               f'{", ".join(sorted(_ALLOWED_DOCUMENT_TYPES))}'
                },
                event=event,
            )

    guest_index = body.get('guestIndex')
    if guest_index is not None:
        if isinstance(guest_index, bool) or not isinstance(guest_index, int):
            return build_response(
                400,
                {'message': 'guestIndex must be a non-negative integer'},
                event=event,
            )
        if guest_index < 0:
            return build_response(
                400,
                {'message': 'guestIndex must be a non-negative integer'},
                event=event,
            )

    try:
        table = dynamodb.Table(BOOKINGS_TABLE)
        booking = table.get_item(Key={'id': booking_id}).get('Item')
        if not booking or not _can_access_booking(event, booking):
            return _booking_not_found_response(event)

        current_state = str(booking.get('state') or '').upper()
        if current_state not in _ALLOWED_UPLOAD_STATES:
            return build_response(
                409,
                {
                    'code': 'BOOKING_STATE_CONFLICT',
                    'message': f'Booking cannot accept documents while it is in {current_state or "UNKNOWN"} state',
                    'currentState': current_state or 'UNKNOWN',
                    'allowedStates': sorted(_ALLOWED_UPLOAD_STATES),
                },
                event=event,
            )
        if not DOCUMENTS_BUCKET:
            _LOG.error('Documents bucket is not configured')
            return build_response(500, {'message': 'Document upload is not configured'}, event=event)

        document_id = str(uuid.uuid4())
        storage_key = f'bookings/{booking_id}/{document_id}'
        document = {
            'id': document_id,
            'name': name,
            'fileFormat': file_format,
            'contentType': content_type,
            'storageKey': storage_key,
        }
        if document_type is not None:
            document['documentType'] = document_type
        if guest_index is not None:
            document['guestIndex'] = guest_index

        table.update_item(
            Key={'id': booking_id},
            UpdateExpression='SET #documents = list_append(if_not_exists(#documents, :empty), :document)',
            ConditionExpression='attribute_exists(id) AND #s = :booked AND #owner = :owner',
            ExpressionAttributeNames={
                '#documents': 'documents',
                '#s': 'state',
                '#owner': 'userId',
            },
            ExpressionAttributeValues={
                ':empty': [],
                ':document': [document],
                ':booked': current_state,
                ':owner': str(principal.get('user_id') or principal.get('sub') or '').strip(),
            },
        )
        upload_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': DOCUMENTS_BUCKET,
                'Key': storage_key,
                'ContentType': content_type,
            },
            ExpiresIn=300,
        )
        return build_response(
            201,
            {
                'document': _public_document(document),
                'uploadUrl': upload_url,
            },
            event=event,
        )
    except Exception as exc:
        _LOG.error('Failed to create upload URL for booking %s: %s', booking_id, str(exc))
        return build_response(
            500,
            {'message': 'Internal server error creating document upload URL.'},
            event=event,
        )


def get_booking_documents(event):
    """GET /bookings/{id}/documents - Return documents visible to the principal."""
    booking_id = (event.get('pathParameters') or {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'}, event=event)

    try:
        booking = dynamodb.Table(BOOKINGS_TABLE).get_item(
            Key={'id': booking_id}
        ).get('Item')
        if not booking or not _can_access_booking(event, booking):
            return _booking_not_found_response(event)

        documents = booking.get('documents')
        if not isinstance(documents, list):
            documents = []

        public_documents = []
        for document in documents:
            if not isinstance(document, dict):
                continue

            public_documents.append(_public_document(document))

        return build_response(200, {'documents': public_documents}, event=event)
    except Exception as exc:
        _LOG.error('Failed to retrieve booking documents for %s: %s', booking_id, str(exc))
        return build_response(
            500,
            {'message': 'Internal server error retrieving booking documents.'},
            event=event,
        )


def get_document_download_url(event):
    """GET /bookings/{id}/documents/{documentId}/download-url - Sign one document."""
    path_parameters = event.get('pathParameters') or {}
    booking_id = path_parameters.get('id')
    document_id = path_parameters.get('documentId')
    if not booking_id or not document_id:
        return build_response(
            400,
            {'message': 'Booking ID and document ID are required'},
            event=event,
        )

    try:
        booking = dynamodb.Table(BOOKINGS_TABLE).get_item(
            Key={'id': booking_id}
        ).get('Item')
        if not booking or not _can_access_booking(event, booking):
            return _booking_not_found_response(event)

        documents = booking.get('documents')
        if not isinstance(documents, list):
            documents = []
        document = next(
            (
                item for item in documents
                if isinstance(item, dict) and str(item.get('id') or '') == document_id
            ),
            None,
        )
        if not document:
            return build_response(
                404,
                {'code': 'DOCUMENT_NOT_FOUND', 'message': 'Document not found'},
                event=event,
            )

        storage_key = str(document.get('storageKey') or '')
        if not storage_key or not DOCUMENTS_BUCKET:
            return build_response(
                404,
                {'code': 'DOCUMENT_NOT_FOUND', 'message': 'Document is unavailable'},
                event=event,
            )

        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': DOCUMENTS_BUCKET, 'Key': storage_key},
            ExpiresIn=300,
        )
        return build_response(200, {'downloadUrl': download_url}, event=event)
    except Exception as exc:
        _LOG.error('Failed to create download URL for document %s: %s', document_id, str(exc))
        return build_response(
            500,
            {'message': 'Internal server error creating document download URL.'},
            event=event,
        )

def put_booking_document(event):
    """PUT /bookings/{id}/documents/{documentId} - Confirm document upload completion."""
    path_parameters = event.get('pathParameters') or {}
    booking_id = path_parameters.get('id')
    document_id = path_parameters.get('documentId')
    if not booking_id or not document_id:
        return build_response(
            400,
            {'message': 'Booking ID and document ID are required'},
            event=event,
        )

    principal = event.get('authenticatedUser') or {}
    if not isinstance(principal, dict) or str(principal.get('role') or '').upper() != 'CUSTOMER':
        return build_response(
            403,
            {'code': 'FORBIDDEN', 'message': 'Only customers can confirm document uploads'},
            event=event,
        )

    try:
        table = dynamodb.Table(BOOKINGS_TABLE)
        booking = table.get_item(Key={'id': booking_id}).get('Item')
        if not booking or not _can_access_booking(event, booking):
            return _booking_not_found_response(event)

        documents = booking.get('documents')
        if not isinstance(documents, list):
            return build_response(
                404,
                {'code': 'DOCUMENT_NOT_FOUND', 'message': 'Document not found'},
                event=event,
            )

        document_index = next(
            (
                idx for idx, item in enumerate(documents)
                if isinstance(item, dict) and str(item.get('id') or '') == document_id
            ),
            -1,
        )
        if document_index == -1:
            return build_response(
                404,
                {'code': 'DOCUMENT_NOT_FOUND', 'message': 'Document not found'},
                event=event,
            )

        document = documents[document_index]
        if document.get('status') == 'CONFIRMED':
            # Already confirmed, return 200 with existing document (idempotent)
            return build_response(200, {'document': _public_document(document)}, event=event)

        # Mark document as confirmed
        updated_documents = [
            {**doc, 'status': 'CONFIRMED'} if str(doc.get('id') or '') == document_id else doc
            for doc in documents
        ]

        table.update_item(
            Key={'id': booking_id},
            UpdateExpression='SET #documents = :documents',
            ConditionExpression='attribute_exists(id) AND #owner = :owner',
            ExpressionAttributeNames={
                '#documents': 'documents',
                '#owner': 'userId',
            },
            ExpressionAttributeValues={
                ':documents': updated_documents,
                ':owner': str(principal.get('user_id') or principal.get('sub') or '').strip(),
            },
        )

        return build_response(200, {'document': _public_document(document)}, event=event)
    except Exception as exc:
        _LOG.error('Failed to confirm document %s for booking %s: %s', document_id, booking_id, str(exc))
        return build_response(
            500,
            {'message': 'Internal server error confirming document upload.'},
            event=event,
        )


def delete_booking_document(event):
    """DELETE /bookings/{id}/documents/{documentId} - Remove a booking document."""
    path_parameters = event.get('pathParameters') or {}
    booking_id = path_parameters.get('id')
    document_id = path_parameters.get('documentId')
    if not booking_id or not document_id:
        return build_response(
            400,
            {'message': 'Booking ID and document ID are required'},
            event=event,
        )

    principal = event.get('authenticatedUser') or {}
    if not isinstance(principal, dict) or str(principal.get('role') or '').upper() != 'CUSTOMER':
        return build_response(
            403,
            {'code': 'FORBIDDEN', 'message': 'Only customers can delete documents'},
            event=event,
        )

    try:
        table = dynamodb.Table(BOOKINGS_TABLE)
        booking = table.get_item(Key={'id': booking_id}).get('Item')
        if not booking or not _can_access_booking(event, booking):
            return _booking_not_found_response(event)

        current_state = str(booking.get('state') or '').upper()
        if current_state not in _ALLOWED_UPLOAD_STATES:
            return build_response(
                409,
                {
                    'code': 'BOOKING_STATE_CONFLICT',
                    'message': f'Booking cannot modify documents while it is in {current_state or "UNKNOWN"} state',
                    'currentState': current_state or 'UNKNOWN',
                    'allowedStates': sorted(_ALLOWED_UPLOAD_STATES),
                },
                event=event,
            )

        documents = booking.get('documents')
        if not isinstance(documents, list):
            documents = []
        document = next(
            (
                item for item in documents
                if isinstance(item, dict) and str(item.get('id') or '') == document_id
            ),
            None,
        )
        if not document:
            return build_response(
                404,
                {'code': 'DOCUMENT_NOT_FOUND', 'message': 'Document not found'},
                event=event,
            )

        remaining_documents = [
            item for item in documents
            if not (isinstance(item, dict) and str(item.get('id') or '') == document_id)
        ]
        table.update_item(
            Key={'id': booking_id},
            UpdateExpression='SET #documents = :documents',
            ConditionExpression='attribute_exists(id) AND #s = :state AND #owner = :owner',
            ExpressionAttributeNames={
                '#documents': 'documents',
                '#s': 'state',
                '#owner': 'userId',
            },
            ExpressionAttributeValues={
                ':documents': remaining_documents,
                ':state': current_state,
                ':owner': str(principal.get('user_id') or principal.get('sub') or '').strip(),
            },
        )

        storage_key = str(document.get('storageKey') or '')
        if storage_key and DOCUMENTS_BUCKET:
            s3_client.delete_object(Bucket=DOCUMENTS_BUCKET, Key=storage_key)

        return build_response(204, {}, event=event)
    except Exception as exc:
        _LOG.error('Failed to delete document %s for booking %s: %s', document_id, booking_id, str(exc))
        return build_response(
            500,
            {'message': 'Internal server error deleting document.'},
            event=event,
        )
