# services/cropper.py
import io
from PIL import Image

def crop_a4_into_10_game_cards(pdf_or_image_bytes: bytes) -> list[bytes]:
    """
    1. Načte obrázek stránky z PDF.
    2. Otočí obrázek o 90° (PIL rotate(90, expand=True) srovná text vodorovně a hlavou nahoru).
    3. Vyřízne 10 herních karet v mřížce 2x5 podle ověřených souřadnic.
    """
    image = Image.open(io.BytesIO(pdf_or_image_bytes))
    
    # Otočení o 90° pro správnou orientaci textu (landscape 3507 x 2480 px)
    rotated_image = image.rotate(90, expand=True)
    width, height = rotated_image.size
    
    # Přesně změřené relativní souřadnice mřížky 2x5 na otočené stránce (v %)
    # Sloupce: Levý (Karty 1-5), Pravý (Karty 6-10)
    col_x_bounds = [
        (0.076, 0.458),  # Levý sloupec (7.6% až 45.8% šířky)
        (0.546, 0.927)   # Pravý sloupec (54.6% až 92.7% šířky)
    ]
    
    # 5 Řádků shora dolů
    row_y_bounds = [
        (0.152, 0.313),  # Řádek 1 (15.2% až 31.3% výšky)
        (0.307, 0.466),  # Řádek 2 (30.7% až 46.6% výšky)
        (0.460, 0.619),  # Řádek 3 (46.0% až 61.9% výšky)
        (0.613, 0.772),  # Řádek 4 (61.3% až 77.2% výšky)
        (0.766, 0.925)   # Řádek 5 (76.6% až 92.5% výšky)
    ]
    
    cards_bytes = []
    
    # Vyřezávání karet po sloupcích (1-5 levý, 6-10 pravý)
    for col_idx, (x_start_pct, x_end_pct) in enumerate(col_x_bounds):
        for row_idx, (y_start_pct, y_end_pct) in enumerate(row_y_bounds):
            left = int(x_start_pct * width)
            top = int(y_start_pct * height)
            right = int(x_end_pct * width)
            bottom = int(y_end_pct * height)
            
            card_crop = rotated_image.crop((left, top, right, bottom))
            
            buffer = io.BytesIO()
            card_crop.save(buffer, format="PNG")
            cards_bytes.append(buffer.getvalue())
            
    return cards_bytes