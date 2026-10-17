import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Přidání kořenového adresáře
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv_path = ".env.local"
if os.path.exists(load_dotenv_path):
    load_dotenv(dotenv_path=load_dotenv_path)

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

SCANS_DIR = os.path.join("public", "scans")

def migrate_local_scans_to_supabase():
    if not os.path.exists(SCANS_DIR):
        print(f"Složka '{SCANS_DIR}' neexistuje!")
        return

    files = [f for f in os.listdir(SCANS_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    print(f"Nalezeno {len(files)} lokálních obrázků ke stažení/nahrání...")

    # Načtení všech draftů z databáze
    drafts = supabase.table("a4_draft_games").select("id, draft_data").execute().data

    uploaded_count = 0
    for filename in files:
        file_path = os.path.join(SCANS_DIR, filename)
        
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        # 1. Nahrání do Supabase Storage
        try:
            supabase.storage.from_("scans").upload(
                path=filename,
                file=file_bytes,
                file_options={"content-type": "image/png", "x-upsert": "true"}
            )
        except Exception as e:
            print(f"  [Info] Obrázek {filename} již existuje nebo varování: {e}")

        # 2. Získání veřejné URL
        public_url = supabase.storage.from_("scans").get_public_url(filename)

        # 3. Aktualizace příslušného draftu v databázi
        for draft in drafts:
            draft_data = draft.get("draft_data") or {}
            local_url = f"/scans/{filename}"
            
            if draft_data.get("card_image_url") == local_url:
                draft_data["card_image_url"] = public_url
                supabase.table("a4_draft_games").update({
                    "draft_data": draft_data
                }).eq("id", draft["id"]).execute()
                uploaded_count += 1
                print(f"  -> Aktualizován draft {draft['id']} -> {public_url}")

    print(f"\n🎉 Migrace dokončena! Nahráno a aktualizováno {uploaded_count} obrázků v Supabase.")

if __name__ == "__main__":
    migrate_local_scans_to_supabase()