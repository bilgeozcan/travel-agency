#!/usr/bin/env python3
"""
tour_detail_seed.py - tour_catalog ve tour_reviews DynamoDB tablolarini
gerceci test verisiyle doldurur (FE gelistirme + QA icin).

Sema, gercek kod okunarak cikarildi (handler.py: _build_tour_summary/_matches_filters,
tours.py: _build_tour_details/get_tour_reviews) - tahmin degil.

TASARIM ILKESI: her edge case KENDI AYRI turunda izole edilir - hicbir tur birden
fazla edge case'i ustlenmez.

Kapsanan edge case'ler:
  - En az 5 tur                          -> 8 tur var
  - En az 1 tamamen dolu tur              -> tour-003 (dedicated, isAvailable=False)
  - En az 1 review'siz tur                -> tour-005 (dedicated, reviews=0, hic review kaydi yok)
  - En az 1 tek meal-plan secenegi olan tur -> tour-004 (dedicated, mealPlans=["AI"])
  - Farkli meal plan / duration kombinasyonlari -> tum turlerde cesitli
  - 10+ toplam review, cesitli puan/tarih -> 31 review, 8 tura dagitilmis

TABLO ADI COZUMLEME (YENI):
  Her gelistiricinin kendi Syndicate suffix'i oldugu icin (orn. tm3-tour_catalog-ahmet
  vs tm3-tour_catalog-serhat), tablo adlari artik ZORUNLU CLI argumani DEGIL.
  Varsayilan davranis: proje icindeki syndicate_aliases.yml dosyasini okuyup
  'tour_catalog_table' ve 'tour_reviews_table' anahtarlarindan cozer - yani
  her gelistirici scripti KENDI ortaminda, ekstra parametre vermeden calistirabilir:

      python tour_detail_seed.py

  Aliases dosyasi bulunamazsa veya icinde bu anahtarlar yoksa, script acik
  hata verir ve --catalog-table/--reviews-table ile elle gecmeni ister.
  Istersen her zaman elle de gecebilirsin (CI/CD, farkli bir ortam, vs.):

      python tour_detail_seed.py --catalog-table X --reviews-table Y --region eu-west-3

Kullanim:
    pip install boto3 pyyaml --break-system-packages
    python tour_detail_seed.py                                   # aliases'tan otomatik coz
    python tour_detail_seed.py --dry-run                          # hicbir seye yazmadan onizle
    python tour_detail_seed.py --catalog-table X --reviews-table Y  # manuel override

Idempotent: sabit id'lerle put_item kullanir, tekrar calistirmak ustune yazar, duplicate uretmez.
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
    yaml = None  # sadece aliases'tan otomatik cozme gerektiginde zorunlu, manuel modda gerekmez


# Script'in bulundugu yere gore varsayilan aliases dosyasi yolu:
# backend/travel-agency-backend-app/deployment/tour_detail_seed.py
#   -> ../.syndicate-config-dev/syndicate_aliases.yml
DEFAULT_ALIASES_PATH = Path(__file__).resolve().parent.parent / ".syndicate-config-dev" / "syndicate_aliases.yml"

ALIAS_KEY_CATALOG = "tour_catalog_table"
ALIAS_KEY_REVIEWS = "tour_reviews_table"


def resolve_table_names(cli_catalog, cli_reviews, aliases_path):
    """
    CLI'dan verilen degerler varsa onlari kullan. Yoksa aliases dosyasindan coz.
    Ikisi de yoksa acik bir hata ile cik (sessizce None birakip DynamoDB hatasi
    almaktan cok daha iyi).
    """
    if cli_catalog and cli_reviews:
        print(f"Tablo adlari CLI argumanlarindan alindi: catalog='{cli_catalog}', reviews='{cli_reviews}'")
        return cli_catalog, cli_reviews

    if yaml is None:
        print(
            "HATA: --catalog-table/--reviews-table verilmedi ve pyyaml kurulu degil, "
            "aliases dosyasi okunamiyor.\n"
            "Coz: pip install pyyaml --break-system-packages\n"
            "Ya da: --catalog-table VE --reviews-table degerlerini elle ver.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not aliases_path.exists():
        print(
            f"HATA: Aliases dosyasi bulunamadi: {aliases_path}\n"
            "Coz: --aliases-file ile dogru yolu ver, ya da --catalog-table VE "
            "--reviews-table degerlerini elle gec.",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(aliases_path, "r", encoding="utf-8") as f:
        aliases = yaml.safe_load(f) or {}

    resolved_catalog = cli_catalog or aliases.get(ALIAS_KEY_CATALOG)
    resolved_reviews = cli_reviews or aliases.get(ALIAS_KEY_REVIEWS)

    missing = []
    if not resolved_catalog:
        missing.append(ALIAS_KEY_CATALOG)
    if not resolved_reviews:
        missing.append(ALIAS_KEY_REVIEWS)

    if missing:
        print(
            f"HATA: Su anahtar(lar) aliases dosyasinda bulunamadi: {', '.join(missing)}\n"
            f"Kontrol edilen dosya: {aliases_path}\n"
            "Coz: syndicate_aliases.yml'e bu anahtarlari ekle, ya da --catalog-table/"
            "--reviews-table ile elle gec.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Tablo adlari aliases dosyasindan cozuldu ({aliases_path}):")
    print(f"  {ALIAS_KEY_CATALOG} -> {resolved_catalog}")
    print(f"  {ALIAS_KEY_REVIEWS} -> {resolved_reviews}")
    return resolved_catalog, resolved_reviews


def d(value):
    """float/int -> Decimal (DynamoDB Number tipi float kabul etmez)."""
    return Decimal(str(value))


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def build_tours(now):
    return [
        {
            "id": "tour-001",
            "name": "Mediterranean Escape",
            "destination": "Antalya, Turkey",
            "isAvailable": True,
            "tourType": "RESORT",
            "startDates": [
                (now + timedelta(days=30)).strftime("%Y-%m-%d"),
                (now + timedelta(days=44)).strftime("%Y-%m-%d"),
                (now + timedelta(days=58)).strftime("%Y-%m-%d"),
            ],
            "durations": ["7 days", "10 days"],
            "mealPlans": ["BB", "HB", "FB"],
            "price": {"7 days": d(1400), "10 days": d(1800)},
            "currency": "USD",
            "rating": d(4.7),
            "reviews": 12,
            "freeCancelation": True,
            "freeCancelationDaysBefore": 10,
            "imageUrls": [
                "https://cdn.example.com/tours/tour-001-1.jpg",
                "https://cdn.example.com/tours/tour-001-2.jpg",
            ],
            "summary": "Beach resort package with guided tours along the Turquoise Coast.",
            "accomodiation": "4-star beachfront hotel, all-inclusive optional.",
            "hotelName": "Sea Breeze Hotel",
            "hotelDescription": "Ocean-view rooms near the city center, 3 pools.",
            "customDetails": {"Tourguide": "English, Turkish", "Transfer": "Airport transfer included"},
            "guestQuantity": {"adultsMaxValue": d(40), "childrenMaxValue": d(20), "totalMaxValue": d(50)},
            "mealSupplementsPerDay": {"BB": d(0), "HB": d(25), "FB": d(40), "AI": d(55)},
        },
        {
            "id": "tour-002",
            "name": "Dolomites: 7-day Guided Hike",
            "destination": "Dolomites Mountains, Italy",
            "isAvailable": True,
            "tourType": "HIKE",
            "startDates": [
                (now + timedelta(days=20)).strftime("%Y-%m-%d"),
                (now + timedelta(days=27)).strftime("%Y-%m-%d"),
            ],
            "durations": ["7 days"],
            "mealPlans": ["BB", "HB", "FB"],
            "price": {"7 days": d(1400)},
            "currency": "USD",
            "rating": d(4.9),
            "reviews": 3,
            "freeCancelation": True,
            "freeCancelationDaysBefore": 10,
            "imageUrls": ["https://cdn.example.com/tours/tour-002-1.jpg"],
            "summary": "Experience 7 days among the wonders of the Brenta Dolomites.",
            "accomodiation": "Shared dormitory-style mountain huts.",
            "hotelName": None,
            "hotelDescription": None,
            "customDetails": {"Tourguide": "English, Italian", "Small group": "Maximum number of participants: 8"},
            "guestQuantity": {"adultsMaxValue": d(8), "childrenMaxValue": d(0), "totalMaxValue": d(8)},
            "mealSupplementsPerDay": {"BB": d(0), "HB": d(25), "FB": d(40)},
        },
        {
            "id": "tour-003",
            "name": "Caribbean Cruise Deluxe",
            "destination": "Punta Cana, Dominican Republic",
            "isAvailable": False,
            "tourType": "CRUISE",
            "startDates": [(now + timedelta(days=15)).strftime("%Y-%m-%d")],
            "durations": ["7 days", "12 days"],
            "mealPlans": ["AI", "BB"],
            "price": {"7 days": d(2200), "12 days": d(3400)},
            "currency": "USD",
            "rating": d(4.5),
            "reviews": 5,
            "freeCancelation": False,
            "freeCancelationDaysBefore": 0,
            "imageUrls": ["https://cdn.example.com/tours/tour-003-1.jpg"],
            "summary": "All-inclusive Caribbean cruise - currently fully booked, high demand.",
            "accomodiation": "Ocean-view cabin, all-inclusive.",
            "hotelName": None,
            "hotelDescription": None,
            "customDetails": {"Tourguide": "English, Spanish"},
            "guestQuantity": {"adultsMaxValue": d(2), "childrenMaxValue": d(1), "totalMaxValue": d(3)},
            "mealSupplementsPerDay": {"AI": d(0), "BB": d(15)},
        },
        {
            "id": "tour-004",
            "name": "Sahara Desert Expedition",
            "destination": "Merzouga, Morocco",
            "isAvailable": True,
            "tourType": "HIKE",
            "startDates": [
                (now + timedelta(days=25)).strftime("%Y-%m-%d"),
                (now + timedelta(days=40)).strftime("%Y-%m-%d"),
            ],
            "durations": ["5 days"],
            "mealPlans": ["AI"],
            "price": {"5 days": d(950)},
            "currency": "USD",
            "rating": d(4.3),
            "reviews": 2,
            "freeCancelation": True,
            "freeCancelationDaysBefore": 7,
            "imageUrls": ["https://cdn.example.com/tours/tour-004-1.jpg"],
            "summary": "Camel trekking and overnight desert camp under the stars.",
            "accomodiation": "Traditional Berber tents, all meals included.",
            "hotelName": None,
            "hotelDescription": None,
            "customDetails": {"Tourguide": "English, French, Arabic", "Small group": "Maximum 10 participants"},
            "guestQuantity": {"adultsMaxValue": d(10), "childrenMaxValue": d(4), "totalMaxValue": d(12)},
            "mealSupplementsPerDay": {"AI": d(0)},
        },
        {
            "id": "tour-005",
            "name": "Nordic Fjords Cruise",
            "destination": "Bergen, Norway",
            "isAvailable": True,
            "tourType": "CRUISE",
            "startDates": [
                (now + timedelta(days=60)).strftime("%Y-%m-%d"),
                (now + timedelta(days=90)).strftime("%Y-%m-%d"),
            ],
            "durations": ["10 days", "14 days"],
            "mealPlans": ["FB", "AI"],
            "price": {"10 days": d(2600), "14 days": d(3300)},
            "currency": "USD",
            "rating": d(0),
            "reviews": 0,
            "freeCancelation": True,
            "freeCancelationDaysBefore": 14,
            "imageUrls": ["https://cdn.example.com/tours/tour-005-1.jpg"],
            "summary": "Brand-new route: scenic fjord cruise through Western Norway.",
            "accomodiation": "Premium cabin with fjord view.",
            "hotelName": None,
            "hotelDescription": None,
            "customDetails": {"Tourguide": "English, Norwegian"},
            "guestQuantity": {"adultsMaxValue": d(30), "childrenMaxValue": d(10), "totalMaxValue": d(35)},
            "mealSupplementsPerDay": {"FB": d(0), "AI": d(20)},
        },
        {
            "id": "tour-006",
            "name": "Tokyo City Explorer",
            "destination": "Tokyo, Japan",
            "isAvailable": True,
            "tourType": "RESORT",
            "startDates": [
                (now + timedelta(days=10)).strftime("%Y-%m-%d"),
                (now + timedelta(days=24)).strftime("%Y-%m-%d"),
                (now + timedelta(days=38)).strftime("%Y-%m-%d"),
            ],
            "durations": ["5 days", "7 days", "10 days"],
            "mealPlans": ["BB", "HB"],
            "price": {"5 days": d(1600), "7 days": d(2100), "10 days": d(2800)},
            "currency": "USD",
            "rating": d(4.2),
            "reviews": 4,
            "freeCancelation": True,
            "freeCancelationDaysBefore": 5,
            "imageUrls": ["https://cdn.example.com/tours/tour-006-1.jpg"],
            "summary": "Guided city tour covering Shibuya, Asakusa and Mt. Fuji day trip.",
            "accomodiation": "3-star central hotel, walking distance to metro.",
            "hotelName": "Shinjuku Central Hotel",
            "hotelDescription": "Compact modern rooms in the heart of the city.",
            "customDetails": {"Tourguide": "English, Japanese", "Transfer": "Metro pass included"},
            "guestQuantity": {"adultsMaxValue": d(20), "childrenMaxValue": d(10), "totalMaxValue": d(25)},
            "mealSupplementsPerDay": {"BB": d(0), "HB": d(30)},
        },
        {
            "id": "tour-007",
            "name": "Swiss Alps Ski Retreat",
            "destination": "Zermatt, Switzerland",
            "isAvailable": True,
            "tourType": "HIKE",
            "startDates": [(now + timedelta(days=120)).strftime("%Y-%m-%d")],
            "durations": ["5 days", "7 days"],
            "mealPlans": ["HB", "FB", "AI"],
            "price": {"5 days": d(2400), "7 days": d(3100)},
            "currency": "USD",
            "rating": d(4.8),
            "reviews": 3,
            "freeCancelation": False,
            "freeCancelationDaysBefore": 0,
            "imageUrls": ["https://cdn.example.com/tours/tour-007-1.jpg"],
            "summary": "Alpine chalet retreat with guided ski and snowshoe excursions.",
            "accomodiation": "Mountain chalet, fireplace lounge, sauna included.",
            "hotelName": "Matterhorn View Chalet",
            "hotelDescription": "Ski-in/ski-out chalet with panoramic Matterhorn views.",
            "customDetails": {"Tourguide": "English, German, French", "Equipment": "Ski rental included"},
            "guestQuantity": {"adultsMaxValue": d(16), "childrenMaxValue": d(6), "totalMaxValue": d(20)},
            "mealSupplementsPerDay": {"HB": d(0), "FB": d(20), "AI": d(45)},
        },
        {
            "id": "tour-008",
            "name": "Bali Wellness Escape",
            "destination": "Ubud, Bali, Indonesia",
            "isAvailable": True,
            "tourType": "RESORT",
            "startDates": [
                (now + timedelta(days=18)).strftime("%Y-%m-%d"),
                (now + timedelta(days=32)).strftime("%Y-%m-%d"),
            ],
            "durations": ["5 days", "7 days", "10 days"],
            "mealPlans": ["BB", "AI"],
            "price": {"5 days": d(1100), "7 days": d(1450), "10 days": d(1900)},
            "currency": "USD",
            "rating": d(3.1),
            "reviews": 2,
            "freeCancelation": True,
            "freeCancelationDaysBefore": 3,
            "imageUrls": ["https://cdn.example.com/tours/tour-008-1.jpg"],
            "summary": "Yoga retreat and spa package surrounded by rice terraces.",
            "accomodiation": "Boutique eco-resort with private villas.",
            "hotelName": "Ubud Rice Terrace Villas",
            "hotelDescription": "Private villas with plunge pools overlooking the terraces.",
            "customDetails": {"Tourguide": "English, Indonesian"},
            "guestQuantity": {"adultsMaxValue": d(12), "childrenMaxValue": d(0), "totalMaxValue": d(12)},
            "mealSupplementsPerDay": {"BB": d(0), "AI": d(35)},
        },
    ]


def build_reviews(now):
    reviews = []

    def add(tour_id, days_ago, author, rate, content):
        reviews.append({
            "id": tour_id,
            "createdAt": iso(now - timedelta(days=days_ago)),
            "authorName": author,
            "authorImageUrl": f"https://cdn.example.com/users/{author.split()[0].lower()}.jpg",
            "rate": rate,
            "reviewContent": content,
        })

    add("tour-001", 90, "Jane Doe", 5, "Excellent tour and very organized schedule.")
    add("tour-001", 85, "Mark Smith", 4, "Great experience, food could be better.")
    add("tour-001", 80, "Elif Yilmaz", 5, "Unforgettable trip, highly recommend the guides.")
    add("tour-001", 75, "Tom Becker", 3, "Good but transfers were delayed twice.")
    add("tour-001", 70, "Aya Tanaka", 5, "Best vacation of the year, will book again.")
    add("tour-001", 65, "Carlos Ruiz", 4, "Beautiful hotel, friendly staff.")
    add("tour-001", 60, "Nina Petrova", 5, "Everything went smoothly, loved the excursions.")
    add("tour-001", 55, "David Lee", 2, "Room was not as described, disappointing.")
    add("tour-001", 50, "Sophie Martin", 5, "Perfect for families, kids loved the pool.")
    add("tour-001", 45, "Ahmed Hassan", 4, "Solid all-around, good value for money.")
    add("tour-001", 40, "Laura Wilson", 5, "Stunning views, professional tour guides.")
    add("tour-001", 35, "Peter Novak", 4, "Would recommend to friends, minor delays only.")

    add("tour-002", 60, "David", 5,
        "Incredible experience! The huts were cozy, and hiking the Brenta Dolomites "
        "was beyond breathtaking. Highly recommended for adventure seekers!")
    add("tour-002", 53, "Maria Conti", 5, "Small group made it very personal, guide was fantastic.")
    add("tour-002", 47, "John Park", 4, "Tough hike but absolutely worth it.")

    add("tour-003", 100, "Olivia Chen", 5, "Amazing cruise, cabin was spacious and clean.")
    add("tour-003", 95, "Ravi Kumar", 4, "Great food options, entertainment was good.")
    add("tour-003", 88, "Emma Brown", 5, "Best cruise we've been on, staff very attentive.")
    add("tour-003", 80, "Lucas Silva", 3, "Ship was crowded, but overall decent trip.")
    add("tour-003", 72, "Grace Kim", 5, "Loved every port stop, will book again next year.")

    add("tour-004", 40, "Youssef Amrani", 5, "Magical night under the stars, unforgettable.")
    add("tour-004", 30, "Isabella Rossi", 4, "Camel ride was fun, camp was a bit basic.")

    # tour-005 - BILEREK HIC REVIEW YOK (edge case: review'siz tur)

    add("tour-006", 45, "Wei Zhang", 4, "Great itinerary, saw all the highlights.")
    add("tour-006", 38, "Anna Kowalski", 5, "Loved the Mt. Fuji day trip, very well organized.")
    add("tour-006", 30, "Hiro Sato", 3, "Hotel location was great, food options limited.")
    add("tour-006", 22, "Chloe Dubois", 4, "Guide was very knowledgeable, would recommend.")

    add("tour-007", 200, "Lars Andersen", 5, "Perfect ski conditions and stunning chalet.")
    add("tour-007", 190, "Fatima Zahra", 5, "Best ski trip ever, equipment rental was seamless.")
    add("tour-007", 180, "Noah Bennett", 4, "Great trip overall, breakfast could be more varied.")

    add("tour-008", 25, "Priya Nair", 2, "Villas were nice but yoga sessions felt rushed.")
    add("tour-008", 18, "Marco Bianchi", 4, "Peaceful setting, spa treatments were excellent.")

    return reviews


EDGE_CASE_SUMMARY = """
Edge case kapsama ozeti:
  - >=5 tur                          -> 8 tur (tour-001..tour-008)
  - Tamamen dolu tur                  -> tour-003 (isAvailable=False)
  - Review'siz tur                    -> tour-005 (reviews=0, hic review kaydi yok)
  - Tek meal-plan secenegi olan tur    -> tour-004 (mealPlans=["AI"])
  - Farkli meal plan/duration kombo    -> tum turlerde (BB/HB/FB/AI karisik, 5-14 gun araligi)
  - 10+ toplam review, cesitli puan    -> 31 review, 2-5 yildiz karisik, 8 tura dagitilmis
"""


def main():
    parser = argparse.ArgumentParser(description="Seed tour_catalog ve tour_reviews tablolari (zengin edge-case seti).")
    parser.add_argument("--catalog-table", default=None, help="Verilmezse aliases dosyasindan cozulur.")
    parser.add_argument("--reviews-table", default=None, help="Verilmezse aliases dosyasindan cozulur.")
    parser.add_argument(
        "--aliases-file",
        default=str(DEFAULT_ALIASES_PATH),
        help=f"syndicate_aliases.yml yolu (varsayilan: {DEFAULT_ALIASES_PATH})",
    )
    parser.add_argument("--region", default=None, help="orn. eu-west-3 (verilmezse AWS_DEFAULT_REGION/profile kullanilir)")
    parser.add_argument("--dry-run", action="store_true", help="hicbir seye yazma, sadece neyin yazilacagini goster")
    args = parser.parse_args()

    catalog_table, reviews_table = resolve_table_names(
        args.catalog_table, args.reviews_table, Path(args.aliases_file)
    )

    now = datetime.now(timezone.utc)
    tours = build_tours(now)
    reviews = build_reviews(now)

    print(f"\nYazilacak: {len(tours)} tur -> '{catalog_table}', {len(reviews)} review -> '{reviews_table}'")
    print(EDGE_CASE_SUMMARY)

    if args.dry_run:
        print("--dry-run: hicbir yazma islemi yapilmadi. Ornek ilk tur ve ilk review:")
        print(tours[0])
        print(reviews[0])
        return

    session_kwargs = {}
    if args.region:
        session_kwargs["region_name"] = args.region

    dynamodb = boto3.resource("dynamodb", **session_kwargs)
    catalog = dynamodb.Table(catalog_table)
    reviews_tbl = dynamodb.Table(reviews_table)

    print("Tur catalog yaziliyor...")
    for tour in tours:
        catalog.put_item(Item=tour)
        print(f"  OK  {tour['id']:10s} {tour['name']:35s} isAvailable={tour['isAvailable']!s:5s} reviews={tour['reviews']}")

    print("\nReviews yaziliyor...")
    for review in reviews:
        reviews_tbl.put_item(Item=review)
    print(f"  OK  {len(reviews)} review kaydi yazildi.")

    print("\nTamamlandi.")
    print(EDGE_CASE_SUMMARY)
    print("Dogrulama onerisi:")
    print(f"  aws dynamodb scan --table-name {catalog_table} --output table")
    print(f"  aws dynamodb query --table-name {reviews_table} --key-condition-expression 'id = :id' "
          f"--expression-attribute-values '{{\":id\":{{\"S\":\"tour-001\"}}}}' --output table")


if __name__ == "__main__":
    main()