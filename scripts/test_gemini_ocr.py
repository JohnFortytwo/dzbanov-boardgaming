import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from PIL import Image

load_dotenv(".env.local")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("Chybí GEMINI_API_KEY v .env.local!")

client = genai.Client(api_key=api_key)

# -------------------------------------------------------------
# FINÁLNÍ ROBUSTNÍ PROMPT S REÁLNÝMI ČÍSELNÍKY ZE SUPABASE
# -------------------------------------------------------------
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

scan_dir = "public/scans"
sample_image = None

if os.path.exists(scan_dir):
    for f in os.listdir(scan_dir):
        if f.endswith(".png") or f.endswith(".jpg"):
            sample_image = os.path.join(scan_dir, f)
            break

if not sample_image:
    print("Nenalezen žádný obrázek ve složce public/scans/!")
    exit(1)

print(f"Odesílám do Gemini obrázek: {sample_image}")
img = Image.open(sample_image)

MODEL_NAME = "gemini-3.8-flash"
response = None

for attempt in range(1, 5):
    try:
        print(f"Odesílám dotaz na {MODEL_NAME} (pokus {attempt}/4)...")
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[img, PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        break
    except ServerError as e:
        print(f"  Server je přetížen (503). Čekám 3 sekundy před dalším pokusem...")
        time.sleep(3)
    except Exception as e:
        print(f"  Chyba: {e}")
        break

if response and response.text:
    print("\n--- Odpověď z Gemini (JSON) ---")
    print(response.text)
else:
    print("\nAni po opakovaných pokusech se nepodařilo získat odpověď.")