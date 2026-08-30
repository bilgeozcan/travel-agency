import json
import os
import re

import boto3
import pwnedpasswords

from commons.api_response import build_response
from commons.log_helper import get_logger
from commons.constants import Role

_LOG = get_logger(__name__)

REGION = os.environ.get('region', 'eu-west-3')
TRAVEL_AGENTS_TABLE = os.environ.get('travel_agents_table')

_dynamodb = boto3.resource('dynamodb', region_name=REGION)

cognito_client = boto3.client(service_name='cognito-idp', region_name=REGION)
CUP_ID = os.environ.get('cup_id')


def normalize_email(email: str) -> str:
    """Normalize an email for allowlist storage and lookup."""
    if not isinstance(email, str):
        raise ValueError("Email must be a string")

    normalized = email.strip().casefold()

    if not normalized:
        raise ValueError("Email must not be empty")

    return normalized


def get_role_for_email(email: str) -> str:
    """
    Return TRAVEL_AGENT only when the normalized email is
    present in the persistent Travel Agent allowlist.
    """
    normalized_email = normalize_email(email)
    table = _dynamodb.Table(TRAVEL_AGENTS_TABLE)
    response = table.get_item(
        Key={'email': normalized_email}
    )

    if 'Item' in response:
        _LOG.info('Travel Agent allowlist match found.')
        return Role.TRAVEL_AGENT

    _LOG.info('No Travel Agent allowlist match. Assigning CUSTOMER role.')
    return Role.CUSTOMER


def assign_role_in_cognito(cognito_client, user_pool_id: str, email: str, role: str) -> None:
    """
    Adds the user to the appropriate Cognito group based on their role.
    Raises on failure so the caller can roll back user creation instead of
    reporting a false success.

    The Cognito client and user pool id are passed in by the caller so that
    a single client/pool configuration (the one already used to create the
    user) is reused instead of creating a second, independent one.
    """
    cognito_client.admin_add_user_to_group(
        UserPoolId=user_pool_id,
        Username=email,
        GroupName=role
    )
    _LOG.info('User added to Cognito group: %s', role)


def handle_signup(event):
    try:
        body = json.loads(event.get('body', '{}'))
    except Exception as e:
        _LOG.error(f"Error parsing body: {str(e)}")
        return build_response(400, {'message': 'Invalid input provided'})

    first_name = body.get('firstName', '').strip()
    last_name = body.get('lastName', '').strip()
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    # Name validation: Max 50 chars, Latin letters, hyphens, apostrophes.
    name_regex = re.compile(r"^[A-Za-z\-' ]{1,50}$")
    if not name_regex.match(first_name) or not name_regex.match(last_name):
        _LOG.error("Validation failed: Invalid first or last name.")
        return build_response(400, {'message': 'Invalid input provided'})

    # Email validation: Max 254 chars, format: username@domain.com
    email_regex = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$")
    if len(email) > 254 or not email_regex.match(email):
        _LOG.error("Validation failed: Invalid email format.")
        return build_response(400, {'message': 'Invalid input provided'})

    # Password validation: 8-64 characters with at least one uppercase, lowercase, number and symbol
    if (len(password) < 8 or len(password) > 64 or
            not re.search(r"[A-Z]", password) or
            not re.search(r"[a-z]", password) or
            not re.search(r"\d", password) or
            not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password)):
        _LOG.error("Validation failed: Password does not meet complexity requirements.")
        return build_response(400, {'message': 'Invalid input provided'})

    try:
        if pwnedpasswords.check(password) > 0:
            _LOG.error("Validation failed: Password has been breached.")
            return build_response(400, {'message': 'This password has appeared in a data breach. Please choose a different one.'})
    except Exception as e:
        _LOG.warning(f"Failed to check Pwned Passwords API: {str(e)}")

    # Determine the role before creating the user (US_3: Automatic Role Assignment)
    role = get_role_for_email(email)

    try:
        create_response = cognito_client.admin_create_user(
            UserPoolId=CUP_ID,
            Username=email,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'email_verified', 'Value': 'true'},
                {'Name': 'given_name', 'Value': first_name},
                {'Name': 'family_name', 'Value': last_name}
            ],
            TemporaryPassword=password,
            MessageAction='SUPPRESS'
        )
        cognito_client.admin_set_user_password(
            UserPoolId=CUP_ID,
            Username=email,
            Password=password,
            Permanent=True
        )

        try:
            assign_role_in_cognito(cognito_client, CUP_ID, email, role)
            
            # --- Automated userId Injection ---
            if role == Role.TRAVEL_AGENT:
                user_attributes = create_response.get('User', {}).get('Attributes', [])
                user_id = next(
                    (attr['Value'] for attr in user_attributes if attr['Name'] == 'sub'),
                    None
                )
                
                if user_id:
                    table = _dynamodb.Table(TRAVEL_AGENTS_TABLE)
                    table.update_item(
                        Key={'email': email},
                        UpdateExpression="SET userId = :uid",
                        ExpressionAttributeValues={':uid': user_id}
                    )
                    _LOG.info('Successfully stored userId for travel agent during signup.')
            
        except Exception as e:
            _LOG.error('User was created but role assignment failed: %s. Rolling back user creation.', e)
            try:
                cognito_client.admin_delete_user(UserPoolId=CUP_ID, Username=email)
            except Exception as rollback_error:
                _LOG.error('Rollback failed: %s', rollback_error)
            return build_response(500, {'message': 'Failed to complete registration'})

        return build_response(201, {'message': 'Account created successfully'})

    except cognito_client.exceptions.UsernameExistsException:
        _LOG.warning('Registration failed: Email already exists')
        return build_response(409, {'message': 'Email already exists'})

    except Exception as e:
        _LOG.error(f"Error creating user in Cognito: {str(e)}")
        return build_response(400, {'message': 'Invalid input provided'})
