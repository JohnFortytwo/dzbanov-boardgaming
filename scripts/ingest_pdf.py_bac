# scripts/ingest_pdf.py
import sys
import os
import pypdf
from PIL import Image
import io

# Přidání kořenového adresáře do PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.scan_processor import process_and_store_a4_scan

def ingest_pdf_file(pdf_path: str):
    if not os.path.exists(pdf_path):
        print(f"Soubor {pdf_path} neexistuje!")
        return

    reader = pypdf.PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"Načítám PDF: {pdf_path} ({total_pages} stránek)")

    for page_idx, page in enumerate(reader.pages, start=1):
        print(f"Zpracovávám stránku {page_idx}/{total_pages}...")
        for image_file_object in page.images:
            image_bytes = image_file_object.data
            
            # Zpracování A4 stránky (ořez na 10 karet -> Gemini -> Supabase)
            scan_id = process_and_store_a4_scan(
                file_bytes=image_bytes,
                file_path=f"{os.path.basename(pdf_path)}#page={page_idx}",
                page_number=page_idx
            )
            print(f"  -> Stránka {page_idx} úspěšně uložena s scan_id: {scan_id}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Použití: python scripts/ingest_pdf.py <cesta_k_pdf>")
    else:
        ingest_pdf_file(sys.argv[1])