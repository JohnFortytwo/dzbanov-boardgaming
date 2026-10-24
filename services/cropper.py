# services/cropper.py
import io
import math
from dataclasses import dataclass

from PIL import Image

# Podíl šířky a výšky karty přidaný na každou stranu.
# Když už je stránka na doraz, okraj se ořízne na její hranu.
CARD_BLEED = 0.10


@dataclass(frozen=True)
class CroppedCard:
    """Uložený výřez karty i s okrajem a poloha původní karty uvnitř něj."""

    image: bytes
    ocr_image: Image.Image
    # Původní okno karty v procentech uloženého PNG (0–100).
    content_x: float
    content_y: float
    content_w: float
    content_h: float


def _percent(part: int, whole: int) -> float:
    return round(part / whole * 100, 4)


def crop_a4_into_10_game_cards(pdf_or_image_bytes: bytes) -> list[CroppedCard]:
    """
    1. Načte obrázek stránky.
    2. Otočí obrázek o 90° (PIL rotate(90, expand=True) srovná text vodorovně a hlavou nahoru).
    3. Vyřízne 10 herních karet v mřížce 2x5 a ke každé přidá okraj CARD_BLEED.
    """
    image = Image.open(io.BytesIO(pdf_or_image_bytes))

    # Otočení o 90° pro správnou orientaci textu (landscape 3507 x 2480 px)
    rotated_image = image.rotate(90, expand=True)
    width, height = rotated_image.size

    # Přesně změřené relativní souřadnice mřížky 2x5 na otočené stránce (v %)
    # Sloupce: Levý (Karty 1-5), Pravý (Karty 6-10)
    col_x_bounds = [
        (0.076, 0.458),  # Levý sloupec (7.6% až 45.8% šířky)
        (0.546, 0.927),  # Pravý sloupec (54.6% až 92.7% šířky)
    ]

    # 5 Řádků shora dolů
    row_y_bounds = [
        (0.152, 0.313),  # Řádek 1 (15.2% až 31.3% výšky)
        (0.307, 0.466),  # Řádek 2 (30.7% až 46.6% výšky)
        (0.460, 0.619),  # Řádek 3 (46.0% až 61.9% výšky)
        (0.613, 0.772),  # Řádek 4 (61.3% až 77.2% výšky)
        (0.766, 0.925),  # Řádek 5 (76.6% až 92.5% výšky)
    ]

    cards: list[CroppedCard] = []

    # Vyřezávání karet po sloupcích (1-5 levý, 6-10 pravý)
    for _col_idx, (x_start_pct, x_end_pct) in enumerate(col_x_bounds):
        for _row_idx, (y_start_pct, y_end_pct) in enumerate(row_y_bounds):
            left0 = int(x_start_pct * width)
            top0 = int(y_start_pct * height)
            right0 = int(x_end_pct * width)
            bottom0 = int(y_end_pct * height)
            card_w = right0 - left0
            card_h = bottom0 - top0
            pad_x = CARD_BLEED * card_w
            pad_y = CARD_BLEED * card_h

            left = max(0, math.floor(left0 - pad_x))
            top = max(0, math.floor(top0 - pad_y))
            right = min(width, math.ceil(right0 + pad_x))
            bottom = min(height, math.ceil(bottom0 + pad_y))

            padded = rotated_image.crop((left, top, right, bottom))
            buffer = io.BytesIO()
            padded.save(buffer, format="PNG")

            saved_w = right - left
            saved_h = bottom - top
            cards.append(
                CroppedCard(
                    image=buffer.getvalue(),
                    ocr_image=rotated_image.crop((left0, top0, right0, bottom0)).copy(),
                    content_x=_percent(left0 - left, saved_w),
                    content_y=_percent(top0 - top, saved_h),
                    content_w=_percent(card_w, saved_w),
                    content_h=_percent(card_h, saved_h),
                )
            )

    return cards