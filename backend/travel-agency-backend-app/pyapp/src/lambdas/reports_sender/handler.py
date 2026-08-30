"""Reports Sender Lambda.

Triggered by the ``reports-sender-schedule`` EventBridge rule
(EPMTPETA-12603). Reads the most recently *completed* ISO week's
``AGENT_PERFORMANCE`` and ``SALES_STATISTICS`` rows out of
``reports_table`` (written incrementally by reports_handler,
EPMTPETA-12598), computes period-over-period deltas against the
previous week, and emails a summary (HTML body + PDF attachment) via
SES.

This Lambda does not reuse ``api_handler/reports.py`` (EPMTPETA-9972,
the on-demand admin dashboard) -- different Lambda, different feature,
and the two report types diverge (this one recomputes deltas for real
and looks up the travel agent's name; ``reports.py`` hardcodes both).

NOTE: ``reports-sender-schedule`` currently fires *daily*
(``cron(0 14 * * ? *)``) rather than weekly, so as-is this will resend
the same completed week's report every day the schedule fires, not
once a week. Fixing the cadence is EPMTPETA-12603's concern, not this
ticket's -- flagged in doc/ai-kb/backend.md.
"""

import os
from datetime import datetime, timedelta, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import boto3
from botocore.exceptions import ClientError
from fpdf import FPDF

from commons.log_helper import get_logger

_LOG = get_logger(__name__)
_REGION = os.environ.get("region", "eu-west-3")
_REPORTS_TABLE = os.environ.get("reports_table")
_USER_POOL_ID = os.environ.get("cup_id")
_SENDER_EMAIL = os.environ.get("sender_email")
_RECIPIENT_EMAIL = os.environ.get("recipient_email")

_STAFF_PERFORMANCE_COLUMNS = [
    "Travel Agent", "TA e-mail", "Report period start", "Report period end",
    "Tours sold", "Delta of tours sold to previous period %",
    "Average Feedback rate for Travel experience (1 to 5)",
    "Minimum Feedback rate for Travel experience (1 to 5)",
    "Delta of Average Feedback rate for Travel experience to previous period %",
    "Revenue for tours finished within reported period (USD)",
    "Delta of revenue for tours finished to previous period %",
]

_SALES_COLUMNS = [
    "Destination", "Report period start", "Report period end",
    "Tours sold", "Delta of tours sold to previous period %",
    "Average Feedback rate for Travel experience (1 to 5)",
    "Minimum Feedback rate for Travel experience (1 to 5)",
    "Delta of Average Feedback rate for Travel experience to previous period %",
    "Revenue for tours finished within reported period (USD)",
    "Delta of revenue for tours finished to previous period %",
]

_SECTION_TITLES = {
    "AGENT_PERFORMANCE": "Staff Performance",
    "SALES_STATISTICS": "Sales Statistics",
}

dynamodb = boto3.resource("dynamodb", region_name=_REGION)
ses = boto3.client("ses", region_name=_REGION)
cognito = boto3.client("cognito-idp", region_name=_REGION)


def _completed_week_start(reference):
    """Monday of the most recently *completed* ISO week, as a date.

    The week containing ``reference`` is still in progress, so the last
    fully-reported week is the one before it.
    """
    current_week_monday = reference.date() - timedelta(days=reference.weekday())
    return current_week_monday - timedelta(days=7)


def _query_report_rows(table, period, report_type):
    response = table.query(
        KeyConditionExpression="period = :p AND begins_with(sortKey, :prefix)",
        ExpressionAttributeValues={":p": period, ":prefix": f"{report_type}#"},
    )
    return response.get("Items", [])


def _rating_stats(item):
    counts = [int(item.get(f"rating{n}Count", 0)) for n in range(1, 6)]
    total = sum(counts)
    if total == 0:
        return 0.0, 0
    weighted = sum((n + 1) * count for n, count in enumerate(counts))
    average = round(weighted / total, 2)
    minimum = next(n + 1 for n, count in enumerate(counts) if count)
    return average, minimum


def _pct_delta(current, previous):
    if not previous:
        return "N/A"
    return f"{round((float(current) - float(previous)) / float(previous) * 100, 1)}%"


def _lookup_ta_name(email):
    if not _USER_POOL_ID:
        return "N/A"
    try:
        response = cognito.admin_get_user(UserPoolId=_USER_POOL_ID, Username=email)
    except ClientError:
        _LOG.warning("Could not look up Cognito user for %s", email, exc_info=True)
        return "N/A"

    attrs = {a["Name"]: a["Value"] for a in response.get("UserAttributes", [])}
    given_name = attrs.get("given_name", "")
    family_name = attrs.get("family_name", "")
    full_name = f"{given_name} {family_name}".strip()
    return full_name or "N/A"


def _build_rows(current_items, previous_by_group, report_type, period_start, period_end):
    rows = []
    for item in current_items:
        group_key = item.get("groupKey") or item.get("sortKey", "").split("#")[-1]
        previous_item = previous_by_group.get(group_key)

        tours_sold = int(item.get("toursCount", 0))
        previous_tours = int(previous_item.get("toursCount", 0)) if previous_item else 0

        revenue = float(item.get("revenue", 0))
        previous_revenue = float(previous_item.get("revenue", 0)) if previous_item else 0.0

        avg_feedback, min_feedback = _rating_stats(item)
        previous_avg_feedback, _ = _rating_stats(previous_item) if previous_item else (0.0, 0)

        common = [
            str(period_start), str(period_end),
            str(tours_sold), _pct_delta(tours_sold, previous_tours),
            str(avg_feedback), str(min_feedback),
            _pct_delta(avg_feedback, previous_avg_feedback),
            str(revenue), _pct_delta(revenue, previous_revenue),
        ]

        if report_type == "AGENT_PERFORMANCE":
            rows.append([_lookup_ta_name(group_key), group_key, *common])
        else:
            rows.append([group_key, *common])

    return rows


def _build_sections(table, period_start, period_end, previous_period_start):
    sections = []
    for report_type, columns in (
        ("AGENT_PERFORMANCE", _STAFF_PERFORMANCE_COLUMNS),
        ("SALES_STATISTICS", _SALES_COLUMNS),
    ):
        current_items = _query_report_rows(table, str(period_start), report_type)
        previous_items = _query_report_rows(table, str(previous_period_start), report_type)
        previous_by_group = {item.get("groupKey"): item for item in previous_items}

        rows = _build_rows(current_items, previous_by_group, report_type, period_start, period_end)
        sections.append((report_type, columns, rows))
    return sections


def _build_pdf(sections):
    pdf = FPDF(orientation="L", format="A4")
    for report_type, columns, rows in sections:
        pdf.add_page()
        pdf.set_font("helvetica", style="B", size=12)
        pdf.cell(0, 10, f"Report: {_SECTION_TITLES[report_type]}", align="C")
        pdf.ln(10)

        pdf.set_font("helvetica", size=7)
        with pdf.table(text_align="CENTER") as table:
            header = table.row()
            for col in columns:
                header.cell(str(col))
            for row in rows:
                data_row = table.row()
                for cell in row:
                    data_row.cell(str(cell))
            if not rows:
                empty_row = table.row()
                empty_row.cell("No activity for the reported period.")
                for _ in columns[1:]:
                    empty_row.cell("")

    return bytes(pdf.output())


def _build_html(sections, period_start, period_end):
    parts = [
        f"<h2>TA Operations Report</h2>"
        f"<p>Period: {period_start} to {period_end}</p>"
    ]
    for report_type, columns, rows in sections:
        parts.append(f"<h3>{_SECTION_TITLES[report_type]}</h3>")
        if not rows:
            parts.append("<p>No activity for the reported period.</p>")
            continue
        parts.append('<table border="1" cellpadding="4" cellspacing="0">')
        parts.append("<tr>" + "".join(f"<th>{col}</th>" for col in columns) + "</tr>")
        for row in rows:
            parts.append("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>")
        parts.append("</table>")
    parts.append("<p>Full PDF report attached.</p>")
    return "".join(parts)


def _build_raw_message(subject, html_body, pdf_bytes, pdf_filename):
    message = MIMEMultipart("mixed")
    message["Subject"] = subject
    message["From"] = _SENDER_EMAIL
    message["To"] = _RECIPIENT_EMAIL

    body = MIMEMultipart("alternative")
    body.attach(MIMEText(html_body, "html", "utf-8"))
    message.attach(body)

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=pdf_filename)
    message.attach(attachment)

    return message.as_string()


def _send_report_email(period_start, period_end, sections):
    pdf_bytes = _build_pdf(sections)
    html_body = _build_html(sections, period_start, period_end)
    subject = f"TA Operations Report - {period_start} to {period_end}"
    raw_message = _build_raw_message(
        subject, html_body, pdf_bytes, f"ta-operations-report-{period_start}.pdf"
    )

    response = ses.send_raw_email(
        Source=_SENDER_EMAIL,
        Destinations=[_RECIPIENT_EMAIL],
        RawMessage={"Data": raw_message},
    )
    return response["MessageId"]


def lambda_handler(event, context):
    if not _SENDER_EMAIL or not _RECIPIENT_EMAIL:
        raise RuntimeError("sender_email and recipient_email must both be configured")

    now = datetime.now(timezone.utc)
    period_start = _completed_week_start(now)
    period_end = period_start + timedelta(days=6)
    previous_period_start = _completed_week_start(now - timedelta(days=7))

    table = dynamodb.Table(_REPORTS_TABLE)
    sections = _build_sections(table, period_start, period_end, previous_period_start)

    message_id = _send_report_email(period_start, period_end, sections)
    _LOG.info("Weekly report email sent: %s (period=%s)", message_id, period_start)

    return {"sent": True, "messageId": message_id, "period": str(period_start)}
