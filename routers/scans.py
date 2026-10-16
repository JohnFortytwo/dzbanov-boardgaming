# routers/scans.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.scan_processor import process_and_store_a4_scan

router = APIRouter(prefix="/api/scans", tags=["A4 Scans"])

@router.post("/upload")
async def upload_a4_scan(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Nahraný soubor musí být obrázek (PNG/JPG).")
        
    contents = await file.read()
    
    # Zavoláme zpracování (ořez + Gemini OCR + uložení do Supabase)
    scan_id = process_and_store_a4_scan(
        file_bytes=contents,
        file_path=file.filename
    )
    
    return {
        "status": "success",
        "scan_id": scan_id,
        "message": "A4 sken byl úspěšně rozřezán, vytěžen pomocí Gemini a uložen do draftu."
    }