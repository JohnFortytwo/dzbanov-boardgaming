"""Ověří nahrání jednoho obrázku do Supabase Storage bucketu scans.

Spuštění z kořene projektu:

    python scripts/test_storage_upload.py
"""
import os
import sys
import urllib.error
import urllib.request

from dotenv import load_dotenv
from supabase import create_client

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IMAGE_PATH = os.path.join(ROOT, "public", "Images", "42.jpg")
BUCKET = "scans"
OBJECT_PATH = "storage-test/42.jpg"


def fail(message: str) -> None:
    print(f"[Chyba] {message}")
    sys.exit(1)


def main() -> None:
    env_path = os.path.join(ROOT, ".env.local")
    if not os.path.exists(env_path):
        fail(f"Chybí {env_path}.")
    load_dotenv(dotenv_path=env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    anon_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase_key = service_key or anon_key
    key_kind = "service role" if service_key else "anon"

    if not supabase_url or not supabase_key:
        fail("V .env.local chybí NEXT_PUBLIC_SUPABASE_URL nebo klíč (service role / anon).")
    if not os.path.isfile(IMAGE_PATH):
        fail(f"Testovací obrázek neexistuje: {IMAGE_PATH}")

    with open(IMAGE_PATH, "rb") as image_file:
        image_bytes = image_file.read()

    print(f"Soubor: {IMAGE_PATH} ({len(image_bytes)} B)")
    print(f"Bucket: {BUCKET}/{OBJECT_PATH}")
    print(f"Klíč:   {key_kind}")

    supabase = create_client(supabase_url, supabase_key)
    try:
        supabase.storage.from_(BUCKET).upload(
            path=OBJECT_PATH,
            file=image_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
    except Exception as error:
        fail(
            f"Nahrání do bucketu '{BUCKET}' selhalo ({key_kind}): {error}"
        )

    public_url = str(supabase.storage.from_(BUCKET).get_public_url(OBJECT_PATH)).strip().rstrip("?")
    if not public_url.startswith("https://"):
        fail(f"Veřejná URL není HTTPS adresa: {public_url!r}")

    request = urllib.request.Request(public_url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            status = response.status
            content_type = response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        fail(f"Upload proběhl, ale stažení {public_url} vrátilo HTTP {error.code}: {detail}")
    except urllib.error.URLError as error:
        fail(f"Upload proběhl, ale veřejnou URL se nepodařilo otevřít: {error.reason}")

    if status != 200 or not body:
        fail(f"Veřejná URL vrátila HTTP {status} a {len(body)} B.")
    if not content_type.startswith("image/"):
        fail(f"Veřejná URL nevrátila obrázek (Content-Type: {content_type}).")

    print(f"Upload: OK")
    print(f"Stažení: HTTP {status}, {content_type}, {len(body)} B")
    print(f"URL: {public_url}")


if __name__ == "__main__":
    main()
