# services/scan_processor.py
import os
import io
from PIL import Image
from supabase import create_client, Client
from services.cropper import crop_a4_into_10_game_cards

load_dotenv_path = ".env.local"
if os.path.exists(load_dotenv_path):
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=load_dotenv_path)

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def process_and_store_a4_scan(file_bytes: bytes, file_path: str, page_number: int = 1):
    """
    1. Vytvoří záznam v a4_scans
    2. Rozřeže A4 na 10 karet v mřížce 2x5
    3. Uloží ořezané obrázky do public/scans/ pro Next.js frontend
    4. Vytvoří dočasné drafty v a4_draft_games (bez AI)
    """
    # Složka pro obrázky prístupná pro Next.js frontend
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
        # Uložení obrázku karty do public/scans/{scan_id}_{index}.png
        card_filename = f"{scan_id}_{index}.png"
        card_path = os.path.join(output_dir, card_filename)
        
        img = Image.open(io.BytesIO(card_bytes))
        img.save(card_path, "PNG")
        
        # Výchozí dočasná struktura pro UI
        empty_draft_json = {
            "card_image_url": f"/scans/{card_filename}",
            "played_at": None,
            "result_code": "VICTORY",
            "difficulty_code": "STANDARD",
            "game_mode_code": "BASE",
            "yellow_disease": "CURED",
            "red_disease": "CURED",
            "blue_disease": "CURED",
            "black_disease": "CURED",
            "purple_disease": None,
            "virulent_strain_color": None,
            "players": [],
            "role_changes": []
        }
        
        draft_records.append({
            "scan_id": scan_id,
            "game_order": index,
            "is_verified": False,
            "draft_data": empty_draft_json
        })
    
    supabase.table("a4_draft_games").insert(draft_records).execute()
    return scan_id