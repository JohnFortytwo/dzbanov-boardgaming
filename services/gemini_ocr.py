# services/gemini_ocr.py
import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Načtení klíčů z .env.local i při spuštění mimo main.py
load_dotenv(dotenv_path=".env.local")

# Inicializace Gemini klienta
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PROMPT_TEMPLATE = """
Jsi specializovaný OCR model pro přepis ručně psaných výsledků deskové hry Pandemic z formuláře.
Tvým úkolem je vytěžit z obrázku data a vrátit je jako čistý JSON.

Dostupné číselníky pro párování:
- Hráči (players): {available_players}
- Role (roles): {available_roles}
- Obtížnosti (difficulties): {available_difficulties}
- Výsledky (game_results): {available_results}
- Stavy nemocí (disease_states): {available_disease_states}

Vrať JSON přesně v této struktuře:
{{
  "played_at": "YYYY-MM-DD nebo null",
  "result_code": "kód z game_results",
  "difficulty_code": "kód z difficulties",
  "game_mode_code": "kód z game_modes (např. BASE)",
  "yellow_disease": "kód z disease_states",
  "red_disease": "kód z disease_states",
  "blue_disease": "kód z disease_states",
  "black_disease": "kód z disease_states",
  "purple_disease": "kód z disease_states nebo null",
  "virulent_strain_color": "kód z virulent_strain_colors nebo null",
  "players": [
    {{
      "raw_name": "přesně přečtené jméno z papíru",
      "matched_player_id": "UUID pokud najdeš shodu v available_players, jinak null",
      "role_code": "kód z roles",
      "player_order": 1
    }}
  ],
  "role_changes": []
}}
"""

def extract_game_data_from_strip(image_bytes: bytes, context_data: dict) -> dict:
    prompt = PROMPT_TEMPLATE.format(
        available_players=json.dumps(context_data.get("players", [])),
        available_roles=json.dumps(context_data.get("roles", [])),
        available_difficulties=json.dumps(context_data.get("difficulties", [])),
        available_results=json.dumps(context_data.get("game_results", [])),
        available_disease_states=json.dumps(context_data.get("disease_states", []))
    )

    response = client.models.generate_content(
        model='gemini-flash-latest',
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type='image/png'),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    return json.loads(response.text)