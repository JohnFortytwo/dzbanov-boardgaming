# scripts/export_page_image.py
import sys
import os
import pypdf
from PIL import Image

def export_rotated_page(pdf_path: str, page_num: int = 1, output_path: str = "calibrator_page.jpg"):
    reader = pypdf.PdfReader(pdf_path)
    page = reader.pages[page_num - 1]
    
    # Načtení prvního obrázku ze stránky PDF
    img_data = page.images[0].image
    
    # Otočení o 90° shodně s cropper.py
    rotated_img = img_data.rotate(90, expand=True)
    rotated_img.save(output_path, "JPEG")
    print(f"✅ Vyexportována otočená stránka {page_num} do souboru: {output_path}")

if __name__ == "__main__":
    pdf_file = sys.argv[1] if len(sys.argv) > 1 else "scan_upload/2strana.pdf"
    export_rotated_page(pdf_file)