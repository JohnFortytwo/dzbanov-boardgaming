import sys
import os
import shutil
import pypdf

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.scan_processor import process_and_store_a4_scan

UPLOAD_DIR = "scan_upload"
USED_DIR = "scan_used"
BATCH_LIMIT = 5

def process_single_pdf(pdf_path: str):
    """Zpracuje jeden PDF soubor stránku po stránce."""
    if not os.path.exists(pdf_path):
        print(f"Soubor {pdf_path} neexistuje!")
        return False

    reader = pypdf.PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"\n--- Načítám PDF: {os.path.basename(pdf_path)} ({total_pages} stránek) ---")

    stored_pages = 0
    for page_idx, page in enumerate(reader.pages, start=1):
        print(f"Zpracovávám stránku {page_idx}/{total_pages}...")
        page_images = list(page.images)
        if not page_images:
            print(f"  [Chyba] Stránka {page_idx} neobsahuje žádný obrázek skenu.")
            return False
        for image_file_object in page_images:
            image_bytes = image_file_object.data

            scan_id = process_and_store_a4_scan(
                file_bytes=image_bytes,
                file_path=f"{os.path.basename(pdf_path)}#page={page_idx}",
                page_number=page_idx
            )
            stored_pages += 1
            print(f"  -> Stránka {page_idx} úspěšně uložena s scan_id: {scan_id}")

    return stored_pages > 0

def process_batch(limit: int = BATCH_LIMIT):
    """Projde složku scan_upload, zpracuje nejvýš 5 PDF a hotové přesune do scan_used."""
    if not os.path.exists(UPLOAD_DIR):
        print(f"Složka '{UPLOAD_DIR}' neexistuje!")
        return

    os.makedirs(USED_DIR, exist_ok=True)

    pdf_files = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith(".pdf")]
    pdf_files.sort()

    if not pdf_files:
        print(f"Ve složce '{UPLOAD_DIR}' nebyly nalezeny žádné PDF soubory.")
        return

    batch_to_process = pdf_files[:limit]
    print(f"Nalezeno {len(pdf_files)} PDF souborů. Zpracovávám dávku {len(batch_to_process)} souborů...")

    for index, filename in enumerate(batch_to_process, start=1):
        src_path = os.path.join(UPLOAD_DIR, filename)
        dst_path = os.path.join(USED_DIR, filename)

        print(f"\n[{index}/{len(batch_to_process)}] Dávkový zpracovatel: {filename}")

        try:
            success = process_single_pdf(src_path)
        except Exception as error:
            print(
                f"  [Chyba] PDF '{filename}' se nepodařilo zpracovat a zůstává ve složce '{UPLOAD_DIR}': {error}"
            )
            continue

        if not success:
            print(
                f"  [Chyba] PDF '{filename}' nebylo dokončeno a zůstává ve složce '{UPLOAD_DIR}'."
            )
            continue

        shutil.move(src_path, dst_path)
        print(f"  -> Přesunuto do '{USED_DIR}/{filename}'")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if os.path.isfile(target):
            process_single_pdf(target)
        else:
            print(f"Předaný argument '{target}' není platný soubor.")
    else:
        process_batch(limit=BATCH_LIMIT)