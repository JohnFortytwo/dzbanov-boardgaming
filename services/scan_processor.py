import os
import io
import json
import time
from datetime import datetime
from PIL import Image
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from services.cropper import crop_a4_into_10_game_cards

load_dotenv_path = ".env.local"
if os.path.exists(load_dotenv_path):
    load_dotenv(dotenv_path=load_dotenv_path)

# Supabase klient
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Gemini API klient
api_key = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=api_key) if api_key else None

PROMPT = """
Jsi expertní OCR systém pro vytěžování ručně psaných dat z herních karet deskové hry Pandemic. 
Z přiloženého obrázku karty extrahuj data do strukturovaného JSONu POUZE podle níže uvedených číselníků a pravidel:

1. DATUM (played_at):
   - Přečti český text data (např. "2. 9. 2023", "02/09/2023", "2.9.23") a převeď ho striktně na ISO formát "YYYY-MM-DD" (např. "2023-09-02").
   - Očekávaný rozsah roků je 2022 až 2026. Pokud je napsán dvoumístný rok (např. "23"), doplň století na "2023". Pokud datum chybí, vrať null.

2. HRÁČI (players -> raw_name):
   - Prozkoumej řádky 1 až 5 ve sloupci nadepsaném "Player".
   - Povolené hodnoty hráčů z databáze (vyber nejbližší odpovídající, pokud je psáno rukou):
     * CJ, Dorian, Gart, Ivoš, Ruiner, Snow, Thunder, Usha, Zelwa
   - Pokud se jméno zcela vymyká, přepiš ho tak, jak je reálně napsané.

3. ROLE (players -> role_code):
   - Ve sloupci "Role" přečti roli na stejném řádku jako příslušného hráče. Pokud je řádek hráče vyplněn, ale pole Role je prázdné, vrať null.
   - Přečtené role mapuj na nejbližší kódy z číselníku:
     * arch, bio, cont, disp, epid, inf, lokál, mech, med, oper, pilot, plán, q, rejža, terka, věd, vir, všest, výzk
   - Pokud se text zcela vymyká, přepiš ho tak, jak je reálně napsaný.

4. VÝSLEDEK HRY (result_code):
   - Vyhodnoť zaškrtávací políčko (křížek X) umístěné VLEVO od popisku v sekci Result. Vrať přesně jednu z těchto hodnot:
     * "Výhra"
     * "Prohra - Kostky"
     * "Prohra - Karty"
     * "Prohra - Pandemie"

5. MÓD HRY (game_mode_code):
   - Vyhodnoť zaškrtávací políčko VLEVO od popisu v sekci vpravo od Challenges. Vrať přesně jednu z těchto hodnot (pokud není nic zaškrtnuto, vrať "Klasika"):
     * "Klasika"
     * "Zhoubný kmen"
     * "Mutace"
     * "Worldwide M."
     * "Laboratoř"
     * "Bioterorista"
     * "Combo"
   - Combo použij pouze v situaci, že je zaškrtnutých více módů naráz.

6. OBTÍŽNOST (difficulty_code):
   - Vyhodnoť zaškrtávací políčko VLEVO od popisu v sekci Difficulty. Vrať přesně jednu z těchto hodnot:
     * "Středně náročná"
     * "Velmi náročná"
     * "Legendární"

7. STAVY NEMOCÍ (yellow_disease, red_disease, blue_disease, black_disease, purple_disease):
   - V tabulce Diseases vyhodnoť zaškrtávací boxy pro sloupce v pořadí: Žlutá, Červená, Modrá, Černá, Fialová.
   - Pro Žlutou, Červenou, Modrou a Černou vrať striktně jednu z hodnot:
     * "Vynalezeno"
     * "Vymýceno"
     * "Nic"
   - Pro Fialovou (purple_disease):
     * Vyhodnocuj POUZE v případě, že je Mód hry "Mutace" nebo "Worldwide M.". Jinak vrať v poli purple_disease hodnotu null.

8. BARVA ZHOUBNÉHO KMENE A POZNÁMKA (virulent_strain_color / note):
   - Pokud je mód hry "Zhoubný kmen" a v poli "Note:" je napsána barva zhoubného kmene, extrahuj ji do "virulent_strain_color" přesně v této české diakritické podobě:
     * "Červená", "Žlutá", "Modrá", "Černá" (případně "Fialová"). Pokud barva uvedena není, vrať null.
   - Jakýkoliv další doplňující text v poli "Note:" přepiš do pole "note". Pokud tam nic jiného není, vrať null.

Očekávaný výstupní JSON formát:
{
  "played_at": "YYYY-MM-DD nebo null",
  "result_code": "Výhra | Prohra - Kostky | Prohra - Karty | Prohra - Pandemie",
  "difficulty_code": "Středně náročná | Velmi náročná | Legendární",
  "game_mode_code": "Klasika | Zhoubný kmen | Mutace | Worldwide M. | Laboratoř | Bioterorista | Combo",
  "players": [
    {"raw_name": "Jméno", "role_code": "arch | bio | cont | disp | epid | inf | lokál | mech | med | oper | pilot | plán | q | rejža | terka | věd | vir | všest | výzk nebo null"}
  ],
  "yellow_disease": "Vynalezeno | Vymýceno | Nic",
  "red_disease": "Vynalezeno | Vymýceno | Nic",
  "blue_disease": "Vynalezeno | Vymýceno | Nic",
  "black_disease": "Vynalezeno | Vymýceno | Nic",
  "purple_disease": "Vynalezeno | Vymýceno | Nic nebo null",
  "virulent_strain_color": "Červená | Žlutá | Modrá | Černá | Fialová nebo null",
  "note": "text poznámky nebo null"
}
"""

def validate_iso_date(date_str: str) -> str | None:
    """Zkontrolovat, zda je řetězec platným kalendářním datem YYYY-MM-DD."""
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        valid_date = datetime.strptime(date_str, "%Y-%m-%d")
        return valid_date.strftime("%Y-%m-%d")
    except ValueError:
        print(f"  [Varování] Neplatné kalendářní datum z OCR: '{date_str}', nastavuji na None.")
        return None

def extract_card_ocr(img: Image.Image) -> dict:
    """Zavolá Gemini OCR pro jeden výstřižek karty."""
    if not gemini_client:
        print("  [OCR] Chybí GEMINI_API_KEY, přeskakuji vytěžování.")
        return {}

    MODEL_NAME = "gemini-3.8-flash"
    for attempt in range(1, 4):
        try:
            response = gemini_client.models.generate_content(
                model=MODEL_NAME,
                contents=[img, PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            if response and response.text:
                return json.loads(response.text)
        except ServerError:
            time.sleep(2)
        except Exception as e:
            print(f"  [OCR Chyba]: {e}")
            break
    return {}

def process_and_store_a4_scan(file_bytes: bytes, file_path: str, page_number: int = 1):
    """
    1. Vytvoří záznam v a4_scans
    2. Rozřeže A4 na 10 karet v mřížce 2x5
    3. Uloží ořezané obrázky do public/scans/
    4. Projde každou kartu přes Gemini OCR
    5. Vytvoří předvyplněné drafty v a4_draft_games
    """
    output_dir = os.path.join("public", "scans")
    os.makedirs(output_dir, exist_ok=True)

    scan_record = supabase.table("a4_scans").insert({
        "file_path": file_path,
        "page_number": page_number,
        "status": "PENDING"
    }).execute().data[0]
    
    scan_id = scan_record["id"]
    cards = crop_a4_into_10_game_cards(file_bytes)
    
    draft_records = []
    
    for index, card_bytes in enumerate(cards, start=1):
        card_filename = f"{scan_id}_{index}.png"
        card_path = os.path.join(output_dir, card_filename)
        
        img = Image.open(io.BytesIO(card_bytes))
        img.save(card_path, "PNG")
        
        print(f"  -> Zpracovávám kartu {index}/10 přes Gemini OCR...")
        ocr_data = extract_card_ocr(img)
        
        raw_played_at = ocr_data.get("played_at")
        valid_played_at = validate_iso_date(raw_played_at)
        
        card_image_url = f"/scans/{card_filename}"
        
        # Kompletní draft_data JSON pro frontend
        draft_json = {
            "card_image_url": card_image_url,
            "played_at": valid_played_at,
            "result_code": ocr_data.get("result_code") or "Výhra",
            "difficulty_code": ocr_data.get("difficulty_code") or "Středně náročná",
            "game_mode_code": ocr_data.get("game_mode_code") or "Klasika",
            "yellow_disease": ocr_data.get("yellow_disease") or "Nic",
            "red_disease": ocr_data.get("red_disease") or "Nic",
            "blue_disease": ocr_data.get("blue_disease") or "Nic",
            "black_disease": ocr_data.get("black_disease") or "Nic",
            "purple_disease": ocr_data.get("purple_disease"),
            "virulent_strain_color": ocr_data.get("virulent_strain_color"),
            "note": ocr_data.get("note"),
            "players": ocr_data.get("players") or [],
            "role_changes": []
        }
        
        draft_records.append({
            "scan_id": scan_id,
            "game_order": index,
            "is_verified": False,
            "status": "pending",
            "draft_data": draft_json,
            "raw_ocr_json": ocr_data,
            "played_at": valid_played_at,
            "result_code": ocr_data.get("result_code"),
            "difficulty_code": ocr_data.get("difficulty_code"),
            "game_mode_code": ocr_data.get("game_mode_code"),
            "yellow_disease": ocr_data.get("yellow_disease"),
            "red_disease": ocr_data.get("red_disease"),
            "blue_disease": ocr_data.get("blue_disease"),
            "black_disease": ocr_data.get("black_disease"),
            "purple_disease": ocr_data.get("purple_disease"),
            "virulent_strain_color": ocr_data.get("virulent_strain_color"),
            "note": ocr_data.get("note"),
            "players": ocr_data.get("players")
        })
    
    supabase.table("a4_draft_games").insert(draft_records).execute()
    return scan_id