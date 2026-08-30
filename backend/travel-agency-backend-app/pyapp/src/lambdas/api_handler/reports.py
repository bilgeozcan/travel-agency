import json
import os
import uuid
import time
import csv
import io
import boto3
try:
    import xlsxwriter
except ImportError:
    xlsxwriter = None

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None
from datetime import datetime, timedelta
from botocore.config import Config
from botocore.exceptions import ClientError

from commons.api_response import build_response
from commons.log_helper import get_logger

_LOG = get_logger(__name__)
REGION = os.environ.get('region', 'eu-west-3')

# Resources & Tables
REPORTS_TABLE = os.environ.get('reports_table', 'Reports')
REPORT_CACHE_TABLE = os.environ.get('report_cache_table')
REPORTS_BUCKET = os.environ.get('reports_bucket')
TRAVEL_AGENTS_TABLE = os.environ.get('travel_agents_table', 'TravelAgents')

dynamodb = boto3.resource('dynamodb', region_name=REGION)
s3_client = boto3.client(
    's3', 
    region_name=REGION, 
    config=Config(signature_version='s3v4', s3={'addressing_style': 'virtual'})
)

# OpenAPI Spec Column Definitions
STAFF_PERFORMANCE_COLUMNS = [
    "Travel Agent", "TA e-mail", "Report period start", "Report period end", 
    "Tours sold", "Delta of tours sold to previous period %", 
    "Average Feedback rate for Travel experience (1 to 5)", 
    "Minimum Feedback rate for Travel experience (1 to 5)", 
    "Delta of Average Feedback rate for Travel experience to previous period %", 
    "Revenue for tours finished within reported period (USD)", 
    "Delta of revenue for tours finished to previous period %"
]

SALES_COLUMNS = [
    "Tour name", "Destination country", "Destination city", 
    "Report period start", "Report period end", "Tours sold", 
    "Delta of tours sold to previous period %", 
    "Average Feedback rate for Travel experience (1 to 5)", 
    "Minimum Feedback rate for Travel experience (1 to 5)", 
    "Delta of Average Feedback rate for Travel experience to previous period %", 
    "Revenue for tours finished within reported period (USD)"
]

def generate_report(event):
    """POST /reports/generate - Generate Report (User Story 11)"""
    try:
        body = json.loads(event.get('body', '{}'))
    except Exception:
        return build_response(400, {'message': 'Invalid JSON body'})

    report_type = body.get('reportType')
    start_date = body.get('startDate')
    end_date = body.get('endDate')
    location = body.get('location')

    # 1. Input Validation
    if not all([report_type, start_date, end_date, location]):
        return build_response(400, {
            'message': 'Validation failed', 
            'errors': 'reportType, startDate, endDate, and location are required.'
        })

    if report_type not in ["STAFF_PERFORMANCE", "SALES"]:
        return build_response(400, {
            'message': 'Validation failed', 
            'errors': 'reportType must be STAFF_PERFORMANCE or SALES'
        })

    # 2. Map Frontend Inputs to US_10 Weekly Schema
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        # Calculate the ISO Mondays for the date range
        current_monday = start_dt - timedelta(days=start_dt.weekday())
        end_monday = end_dt - timedelta(days=end_dt.weekday())
    except ValueError:
        return build_response(400, {'message': 'Validation failed', 'errors': 'Dates must be YYYY-MM-DD'})

    backend_report_type = "AGENT_PERFORMANCE" if report_type == "STAFF_PERFORMANCE" else "SALES_STATISTICS"
    
    if backend_report_type == "SALES_STATISTICS":
        sk_prefix = f"{backend_report_type}#{location.lower()}"
    else:
        # US_10 agent performance is grouped by email, not location.
        sk_prefix = f"{backend_report_type}#"

    reports_table = dynamodb.Table(REPORTS_TABLE)
    aggregated_data = {}
    rows = []
    
    try:
        # 3. Query US_10 Data for all weeks in the range
        while current_monday <= end_monday:
            target_period = current_monday.strftime("%Y-%m-%d")
            
            response = reports_table.query(
                KeyConditionExpression="period = :p AND begins_with(sortKey, :sk)",
                ExpressionAttributeValues={
                    ":p": target_period,
                    ":sk": sk_prefix
                }
            )
            
            # Aggregate the counters mathematically
            for item in response.get('Items', []):
                group_key = str(item.get('sortKey', '')).split('#')[-1]
                
                if group_key not in aggregated_data:
                    aggregated_data[group_key] = {
                        "r1": 0, "r2": 0, "r3": 0, "r4": 0, "r5": 0,
                        "revenue": 0, "tours_sold": 0
                    }
                
                agg = aggregated_data[group_key]
                agg["r1"] += int(item.get('rating1Count', 0))
                agg["r2"] += int(item.get('rating2Count', 0))
                agg["r3"] += int(item.get('rating3Count', 0))
                agg["r4"] += int(item.get('rating4Count', 0))
                agg["r5"] += int(item.get('rating5Count', 0))
                agg["revenue"] += item.get('revenue', 0)
                agg["tours_sold"] += item.get('toursCount', 0)
            
            current_monday += timedelta(days=7)
            
        # 4. Map and Calculate On-The-Fly Metrics for OpenAPI
        agents_table = dynamodb.Table(TRAVEL_AGENTS_TABLE)
        agent_names_cache = {}

        for group_key, agg in aggregated_data.items():
            total_ratings = agg["r1"] + agg["r2"] + agg["r3"] + agg["r4"] + agg["r5"]
            
            if total_ratings > 0:
                avg_feedback = round((agg["r1"]*1 + agg["r2"]*2 + agg["r3"]*3 + agg["r4"]*4 + agg["r5"]*5) / total_ratings, 2)
                min_feedback = 1 if agg["r1"] else (2 if agg["r2"] else (3 if agg["r3"] else (4 if agg["r4"] else 5)))
            else:
                avg_feedback = 0.0
                min_feedback = 0

            revenue = agg["revenue"]
            tours_sold = agg["tours_sold"]
                
            if report_type == "STAFF_PERFORMANCE":
                # Look up the agent's real name using their email
                if group_key not in agent_names_cache:
                    try:
                        agent_resp = agents_table.get_item(Key={'email': group_key})
                        agent_item = agent_resp.get('Item', {})
                        first = agent_item.get('given_name', agent_item.get('firstName', ''))
                        last = agent_item.get('family_name', agent_item.get('lastName', ''))
                        full_name = f"{first} {last}".strip()
                        agent_names_cache[group_key] = full_name if full_name else agent_item.get('name', group_key)
                    except ClientError as e:
                        _LOG.warning(f"Failed to fetch agent name for {group_key}: {e}")
                        agent_names_cache[group_key] = group_key
                
                agent_name = agent_names_cache.get(group_key, group_key)

                rows.append([
                    str(agent_name), 
                    str(group_key), 
                    str(start_date), # Use requested start date to reflect full range
                    str(end_date),
                    str(tours_sold),
                    str("0%"), 
                    str(avg_feedback),
                    str(min_feedback),
                    str("0%"), 
                    str(revenue),
                    str("0%") 
                ])
            elif report_type == "SALES":
                rows.append([
                    str("Multiple"), 
                    str(location), 
                    str(location), 
                    str(start_date), # Use requested start date to reflect full range
                    str(end_date),
                    str(tours_sold),
                    str("0%"), 
                    str(avg_feedback),
                    str(min_feedback),
                    str("0%"), 
                    str(revenue)
                ])
    except ClientError as e:
        _LOG.error(f"Failed to query Reports table: {e}")
        return build_response(500, {'message': 'Internal server error while retrieving report data.'})

    columns = STAFF_PERFORMANCE_COLUMNS if report_type == "STAFF_PERFORMANCE" else SALES_COLUMNS

    report_data = {
        "columns": columns,
        "rows": rows
    }

    # 5. Cache the Report Data
    cached_report_key = str(uuid.uuid4())
    cache_table = dynamodb.Table(REPORT_CACHE_TABLE)
    expiration_time = int(time.time()) + 1800 

    try:
        cache_table.put_item(
            Item={
                'id': cached_report_key,
                'reportType': report_type,
                'reportData': report_data,
                'ttl': expiration_time 
            }
        )
    except ClientError as e:
        _LOG.error(f"Failed to cache report data: {e}")
        return build_response(500, {'message': 'Failed to cache report generation.'})

    return build_response(200, {
        "cachedReportKey": cached_report_key,
        "reportType": report_type,
        "reportData": report_data
    })


def download_report(event):
    """GET /reports/download - Download Report (User Story 11)"""
    params = event.get('queryStringParameters') or {}
    cached_report_key = params.get('cachedReportKey')
    file_format = str(params.get('format') or '').lower()

    # 1. Input Validation
    if not cached_report_key:
        return build_response(400, {'message': 'Validation failed', 'errors': 'cachedReportKey is required'})
    if file_format not in ['pdf', 'excel', 'csv']:
        return build_response(400, {'message': 'Validation failed', 'errors': 'format must be one of pdf, excel, csv'})

    # 2. Fetch Cached Data
    cache_table = dynamodb.Table(REPORT_CACHE_TABLE)
    try:
        response = cache_table.get_item(Key={'id': cached_report_key})
        item = response.get('Item')
    except ClientError as e:
        _LOG.error(f"Failed to fetch cached report: {e}")
        return build_response(500, {'message': 'Internal server error'})

    # Check if item exists and hasn't expired (DynamoDB TTL deletion can take up to 48 hours, so we manually verify)
    if not item or item.get('ttl', 0) < int(time.time()):
        return build_response(404, {'error': 'Cached report data not found or expired.'})

    report_data = item.get('reportData', {})
    columns = report_data.get('columns', [])
    rows = report_data.get('rows', [])
    
    # 3. Generate File Content in Memory
    file_extension = file_format

    if file_format == 'csv':
        file_buffer = io.StringIO()
        writer = csv.writer(file_buffer)
        writer.writerow(columns)
        writer.writerows(rows)
        content_type = 'text/csv'
        file_extension = 'csv'
        file_content = file_buffer.getvalue().encode('utf-8')
        
    elif file_format == 'excel':
        file_buffer = io.BytesIO()
        # in_memory=True strictly prevents XlsxWriter from touching the Lambda's /tmp disk
        workbook = xlsxwriter.Workbook(file_buffer, {'in_memory': True})
        worksheet = workbook.add_worksheet()
        
        # Write column headers at row 0, col 0
        worksheet.write_row(0, 0, columns)
        
        # Write data starting at row 1
        for row_num, row_data in enumerate(rows, start=1):
            worksheet.write_row(row_num, 0, row_data)
            
        workbook.close()
        
        content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        file_extension = 'xlsx'
        file_content = file_buffer.getvalue()
    
    elif file_format == 'pdf':
        # Generate Native PDF using fpdf2
        pdf = FPDF(orientation='L', format='A4')
        pdf.add_page()
        
        # Add Report Title
        pdf.set_font("helvetica", style="B", size=12)
        pdf.cell(0, 10, f"Report: {item.get('reportType', 'Statistics')}", align="C")
        pdf.ln(10)
        
        # Build Table
        pdf.set_font("helvetica", size=7)
        with pdf.table(text_align="CENTER") as table:
            # Header
            header = table.row()
            for col in columns:
                header.cell(str(col))
            # Data Rows
            for row in rows:
                data_row = table.row()
                for cell in row:
                    data_row.cell(str(cell))
                    
        content_type = 'application/pdf'
        file_content = bytes(pdf.output()) # Extract raw binary PDF
    file_name = f"report_{cached_report_key}.{file_extension}"

    # 4. Upload to S3
    try:
        s3_client.put_object(
            Bucket=REPORTS_BUCKET,
            Key=file_name,
            Body=file_content,
            ContentType=content_type,
            ContentDisposition=f'attachment; filename="{file_name}"'
        )
    except ClientError as e:
        _LOG.error(f"Failed to upload report to S3: {e}")
        return build_response(500, {'message': 'Failed to generate report file'})

    # 5. Generate Presigned URL (Valid for 15 minutes)
    try:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': REPORTS_BUCKET, 'Key': file_name},
            ExpiresIn=900
        )
    except ClientError as e:
        _LOG.error(f"Failed to generate presigned URL: {e}")
        return build_response(500, {'message': 'Failed to generate download link'})

    # 6. Return Response
    return build_response(200, {
        "fileUrl": presigned_url
    })