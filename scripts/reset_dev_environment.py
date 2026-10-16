# scripts/reset_dev_environment.py
import os
import glob
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=".env.local")

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def safe_reset_staging():
    print("🧹 Zahajuji BEZPEČNÝ reset staging prostředí (ostré hry v pandemic_games zůstanou nedotčeny)...")

    # 1. Promazání výhradně dočasných staging tabulek
    supabase.table("a4_draft_games").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("a4_scans").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("  ✓ Staging tabulky (a4_scans, a4_draft_games) vyčištěny.")

    # 2. Smazání PNG výstřižků ze složky public/scans/
    scans_dir = os.path.join("public", "scans")
    if os.path.exists(scans_dir):
        files = glob.glob(os.path.join(scans_dir, "*.png"))
        for f in files:
            os.remove(f)
        print(f"  ✓ Smazáno {len(files)} obrázků ze složky public/scans/.")

    print("\n✅ Staging je čistý! Ostrá databáze pandemic_games nebyla nijak dotčena.")

if __name__ == "__main__":
    confirm = input("Opravdu chceš vyčistit dočasné A4 skeny a drafty? (ano/ne): ")
    if confirm.lower() in ["ano", "a", "yes", "y"]:
        safe_reset_staging()
    else:
        print("Reset zrušen.")