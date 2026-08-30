#!/usr/bin/env python3
"""
booking_feedback_seed.py - bookings ve feedbacks DynamoDB tablolarini
tour_detail_seed.py / provision_travel_agent_allowlist.py ile UYUMLU test
verisiyle doldurur.

Uyumluluk:
  - tourId'ler tour_detail_seed.py:build_tours()'tan GELIYOR (ayri bir kopya
    tutmuyoruz - fiyat/destinasyon/mealPlan burada asla tour_detail_seed.py'den
    sapamaz).
  - travelAgent.email = 'agent@travelco.com', provision_travel_agent_allowlist.py'nin
    seed'lediği TEK allowlist kaydiyla ayni (deployment/travel_agent_allowlist_seed.json).
  - Item semasi bookings.py:create_booking() (booking_item, L351-372) ve
    feedback.py:_save_feedback() (feedback_item, L235-249) okunarak birebir
    cikarildi - tahmin degil.

NOT (bilinen sinirlama, bilerek): musteri userId/customerEmail alanlari SAHTE
placeholder'lar - gercek bir Cognito kullanicisina baglanmiyor (syn clean sonrasi
pool sifirlandi, henuz gercek sign-up yok). Sadece GET/reports-pipeline testleri
icin yeterli; "bu musteri olarak giris yap" gibi bir senaryo icin kullanilamaz.

Kapsanan durumlar (booking state machine):
  - booking-seed-001, tour-001 (Antalya)   -> FINISHED, feedback rating=5
  - booking-seed-002, tour-002 (Dolomites) -> FINISHED, feedback rating=2 (yorum zorunlu, var)
  - booking-seed-003, tour-001 (Antalya)   -> CONFIRMED (henuz feedback/report'a girmemeli)
  - booking-seed-004, tour-006 (Tokyo)     -> STARTED, feedback rating=4 (yorum opsiyonel, yok)
  - booking-seed-005, tour-003 (Punta Cana)-> CANCELED (canceledByRole=CUSTOMER)
  - booking-seed-006, tour-004 (Merzouga)  -> BOOKED

Tumu ayni TA'ya (agent@travelco.com) bagli - EPMTPETA-12598 (Reports Handler)
manuel testi icin FINISHED+feedback'li booking'ler kasitli olarak iki farkli
destinasyona (Antalya, Dolomites) dagitildi ki AGENT_PERFORMANCE'ta tek satirda
toplanirken SALES_STATISTICS'te iki ayri satira ayrildigi gorulebilsin.

Kullanim:
    python booking_feedback_seed.py                 # aliases'tan otomatik coz
    python booking_feedback_seed.py --dry-run        # hicbir seye yazmadan onizle
    python booking_feedback_seed.py --region eu-west-3

Calistirmadan once tour_detail_seed.py'nin calismis olmasi beklenir (tourId
referanslari o tabloya isaret ediyor, ama bu script'in kendisi tour_catalog'a
yazmiyor/okumuyor - sadece ayni sabit tur tanimlarini import ediyor).

Idempotent: sabit id'lerle put_item kullanir, tekrar calistirmak ustune yazar.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

try:
    import boto3
except ImportError:
    print("boto3 bulunamadi. Once calistir: pip install boto3 pyyaml --break-system-packages", file=sys.stderr)
    sys.exit(1)

try:
    import yaml
except ImportError:
    yaml = None

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tour_detail_seed import build_tours  # noqa: E402  (ayni klasorden, tur verisinin TEK kaynagi)


DEFAULT_ALIASES_PATH = Path(__file__).resolve().parent.parent / ".syndicate-config-dev" / "syndicate_aliases.yml"

ALIAS_KEY_BOOKINGS = "bookings_table"
ALIAS_KEY_FEEDBACKS = "feedbacks_table"
ALIAS_KEY_REPORTS_QUEUE = "reports_queue"
ALIAS_KEY_REPORTS_TABLE = "reports_table"

TRAVEL_AGENT = {
    "name": "Agent Travelco",
    "email": "agent@travelco.com",
    "phone": "N/A",
    "messenger": "N/A",
    "userId": "",  # gercek bir TA sign-up olmadan bos - signup.py bunu ancak gercek Cognito sub'iyla dolduruyor
}


def _load_yaml(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def resolve_names(cli_bookings, cli_feedbacks, aliases_path):
    if cli_bookings and cli_feedbacks:
        return cli_bookings, cli_feedbacks, None, "<reports_table>"

    if yaml is None:
        print(
            "HATA: --bookings-table/--feedbacks-table verilmedi ve pyyaml kurulu degil.\n"
            "Coz: pip install pyyaml --break-system-packages",
            file=sys.stderr,
        )
        sys.exit(1)

    if not aliases_path.exists():
        print(f"HATA: Aliases dosyasi bulunamadi: {aliases_path}", file=sys.stderr)
        sys.exit(1)

    aliases = _load_yaml(aliases_path)

    resolved_bookings = cli_bookings or aliases.get(ALIAS_KEY_BOOKINGS)
    resolved_feedbacks = cli_feedbacks or aliases.get(ALIAS_KEY_FEEDBACKS)
    reports_queue_name = aliases.get(ALIAS_KEY_REPORTS_QUEUE)
    reports_table_name = aliases.get(ALIAS_KEY_REPORTS_TABLE, "<reports_table>")
    account_id = aliases.get("account_id")
    region = aliases.get("region")

    missing = [
        key for key, value in (
            (ALIAS_KEY_BOOKINGS, resolved_bookings),
            (ALIAS_KEY_FEEDBACKS, resolved_feedbacks),
        ) if not value
    ]
    if missing:
        print(
            f"HATA: Su anahtar(lar) aliases dosyasinda bulunamadi: {', '.join(missing)}\n"
            f"Kontrol edilen dosya: {aliases_path}",
            file=sys.stderr,
        )
        sys.exit(1)

    queue_url = None
    if reports_queue_name and account_id and region:
        queue_url = f"https://sqs.{region}.amazonaws.com/{account_id}/{reports_queue_name}"

    print(f"Tablo adlari aliases dosyasindan cozuldu ({aliases_path}):")
    print(f"  {ALIAS_KEY_BOOKINGS} -> {resolved_bookings}")
    print(f"  {ALIAS_KEY_FEEDBACKS} -> {resolved_feedbacks}")
    return resolved_bookings, resolved_feedbacks, queue_url, reports_table_name


def d(value):
    return Decimal(str(value))


def _price_for(tour, duration_str):
    base_price = tour["price"][duration_str]
    return f"${int(base_price)}"


def build_bookings(now, tours_by_id):
    def tour_details(tour_id, duration_str, meal_plan, days_offset):
        tour = tours_by_id[tour_id]
        start_date = (now + timedelta(days=days_offset)).strftime("%Y-%m-%d")
        return {
            "date": f"{start_date} ({duration_str})",
            "mealPlan": meal_plan,
            "guests": "Seed Customer (1 adults, 0 children)",
            "totalPrice": _price_for(tour, duration_str),
            "documents": "0 items",
        }

    def base_item(booking_id, tour_id, duration_str, meal_plan, state, days_offset, customer_suffix):
        tour = tours_by_id[tour_id]
        image_urls = tour.get("imageUrls", [])
        return {
            "id": booking_id,
            "userId": f"seed-customer-{customer_suffix}",
            "customerEmail": f"seed.customer{customer_suffix}@example.com",
            "tourId": tour_id,
            "state": state,
            "name": tour["name"],
            "destination": tour["destination"],
            "tourImageUrl": image_urls[0] if image_urls else "",
            "personalDetails": [{"firstName": "Seed", "lastName": f"Customer{customer_suffix}"}],
            "tourDetails": tour_details(tour_id, duration_str, meal_plan, days_offset),
            "travelAgent": dict(TRAVEL_AGENT),
            "canceledBy": None,
            "cancelReason": None,
            "freeCancelation": None,
        }

    bookings = [
        base_item("booking-seed-001", "tour-001", "7 days", "BB", "FINISHED", -60, 1),
        base_item("booking-seed-002", "tour-002", "7 days", "HB", "FINISHED", -45, 2),
        base_item("booking-seed-003", "tour-001", "7 days", "BB", "CONFIRMED", 30, 3),
        base_item("booking-seed-004", "tour-006", "5 days", "BB", "STARTED", -2, 4),
        base_item("booking-seed-005", "tour-003", "7 days", "AI", "CANCELED", 15, 5),
        base_item("booking-seed-006", "tour-004", "5 days", "AI", "BOOKED", 25, 6),
    ]

    # booking-seed-005: CANCELED durumuna gercek cancel_booking() alanlarini ekle
    canceled = bookings[4]
    canceled["canceledBy"] = "seed-customer-5"
    canceled["cancelReason"] = "Change of plans"
    canceled["canceledByRole"] = "CUSTOMER"

    return bookings


def build_feedbacks(now):
    return [
        {
            "id": "feedback-seed-001",
            "bookingId": "booking-seed-001",
            "tourId": "tour-001",
            "userId": "seed-customer-1",
            "rating": d(5),
            "comment": "Fantastic trip, highly recommend the guides!",
            "createdAt": (now - timedelta(days=58)).isoformat(),
            "updatedAt": (now - timedelta(days=58)).isoformat(),
        },
        {
            "id": "feedback-seed-002",
            "bookingId": "booking-seed-002",
            "tourId": "tour-002",
            "userId": "seed-customer-2",
            "rating": d(2),
            "comment": "Guide was often late and the itinerary felt rushed.",
            "createdAt": (now - timedelta(days=43)).isoformat(),
            "updatedAt": (now - timedelta(days=43)).isoformat(),
        },
        {
            # rating>=4 -> yorum opsiyonel, bilerek eklenmedi (schema'nin bu yolunu da kapsasin diye)
            "id": "feedback-seed-004",
            "bookingId": "booking-seed-004",
            "tourId": "tour-006",
            "userId": "seed-customer-4",
            "rating": d(4),
            "createdAt": (now - timedelta(hours=6)).isoformat(),
            "updatedAt": (now - timedelta(hours=6)).isoformat(),
        },
    ]


def _period_for(now):
    """ISO hafta baslangici (Pazartesi), YYYY-MM-DD - reports_handler'in 'period' alaniyla ayni format."""
    monday = now - timedelta(days=now.weekday())
    return monday.strftime("%Y-%m-%d")


def print_reports_queue_samples(bookings, feedbacks, queue_url, reports_table_name, now):
    if not queue_url:
        return

    period = _period_for(now)
    print("\nEPMTPETA-12598 (Reports Handler) manuel test icin ornek SQS mesajlari:")
    print(f"(queue: {queue_url}, period: {period})\n")

    finished = [b for b in bookings if b["state"] == "FINISHED"]
    feedback_by_booking = {f["bookingId"]: f for f in feedbacks}

    for booking in finished:
        revenue = booking["tourDetails"]["totalPrice"].lstrip("$")
        body = (
            '{'
            f'"messageId":"evt-{booking["id"]}-BOOKING_FINISHED",'
            '"eventType":"BOOKING_FINISHED",'
            f'"period":"{period}",'
            f'"bookingId":"{booking["id"]}",'
            f'"travelAgent":{{"email":"{booking["travelAgent"]["email"]}"}},'
            f'"destination":"{booking["destination"]}",'
            f'"revenue":{revenue}'
            '}'
        )
        print(f"aws sqs send-message --queue-url {queue_url} --message-body '{body}'")

        feedback = feedback_by_booking.get(booking["id"])
        if feedback:
            fb_body = (
                '{'
                f'"messageId":"evt-{booking["id"]}-FEEDBACK_SUBMITTED",'
                '"eventType":"FEEDBACK_SUBMITTED",'
                f'"period":"{period}",'
                f'"bookingId":"{booking["id"]}",'
                f'"travelAgent":{{"email":"{booking["travelAgent"]["email"]}"}},'
                f'"destination":"{booking["destination"]}",'
                f'"rating":{int(feedback["rating"])}'
                '}'
            )
            print(f"aws sqs send-message --queue-url {queue_url} --message-body '{fb_body}'")

    print(
        "\nGondermeden sonra dogrulama:\n"
        f"  aws dynamodb get-item --table-name {reports_table_name} "
        "--key '{\"period\":{\"S\":\"" + period + "\"},\"sortKey\":{\"S\":\"AGENT_PERFORMANCE#agent@travelco.com\"}}'"
    )


def main():
    parser = argparse.ArgumentParser(
        description="Seed bookings ve feedbacks tablolarini (tour_detail_seed.py ile uyumlu)."
    )
    parser.add_argument("--bookings-table", default=None, help="Verilmezse aliases dosyasindan cozulur.")
    parser.add_argument("--feedbacks-table", default=None, help="Verilmezse aliases dosyasindan cozulur.")
    parser.add_argument(
        "--aliases-file",
        default=str(DEFAULT_ALIASES_PATH),
        help=f"syndicate_aliases.yml yolu (varsayilan: {DEFAULT_ALIASES_PATH})",
    )
    parser.add_argument("--region", default=None, help="orn. eu-west-3 (verilmezse AWS_DEFAULT_REGION/profile kullanilir)")
    parser.add_argument("--dry-run", action="store_true", help="hicbir seye yazma, sadece neyin yazilacagini goster")
    args = parser.parse_args()

    bookings_table, feedbacks_table, reports_queue_url, reports_table_name = resolve_names(
        args.bookings_table, args.feedbacks_table, Path(args.aliases_file)
    )

    now = datetime.now(timezone.utc)
    tours_by_id = {tour["id"]: tour for tour in build_tours(now)}

    missing_tours = {"tour-001", "tour-002", "tour-003", "tour-004", "tour-006"} - set(tours_by_id)
    if missing_tours:
        print(
            f"HATA: tour_detail_seed.py:build_tours() beklenen tourId'leri icermiyor: {missing_tours}\n"
            "tour_detail_seed.py degismis olabilir - bu script ile senkronize et.",
            file=sys.stderr,
        )
        sys.exit(1)

    bookings = build_bookings(now, tours_by_id)
    feedbacks = build_feedbacks(now)

    print(f"\nYazilacak: {len(bookings)} booking -> '{bookings_table}', {len(feedbacks)} feedback -> '{feedbacks_table}'")

    if args.dry_run:
        print("--dry-run: hicbir yazma islemi yapilmadi. Ornek ilk booking ve ilk feedback:")
        print(bookings[0])
        print(feedbacks[0])
        print_reports_queue_samples(bookings, feedbacks, reports_queue_url, reports_table_name, now)
        return

    session_kwargs = {}
    if args.region:
        session_kwargs["region_name"] = args.region

    dynamodb = boto3.resource("dynamodb", **session_kwargs)
    bookings_tbl = dynamodb.Table(bookings_table)
    feedbacks_tbl = dynamodb.Table(feedbacks_table)

    print("Booking'ler yaziliyor...")
    for booking in bookings:
        bookings_tbl.put_item(Item=booking)
        print(f"  OK  {booking['id']:20s} {booking['state']:10s} tourId={booking['tourId']}")

    print("\nFeedback'ler yaziliyor...")
    for feedback in feedbacks:
        feedbacks_tbl.put_item(Item=feedback)
        print(f"  OK  {feedback['id']:20s} bookingId={feedback['bookingId']:20s} rating={feedback['rating']}")

    print("\nTamamlandi.")
    print_reports_queue_samples(bookings, feedbacks, reports_queue_url, reports_table_name, now)


if __name__ == "__main__":
    main()
