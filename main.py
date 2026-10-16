# main.py
from fastapi import FastAPI
from dotenv import load_dotenv

# Načtení proměnných z .env.local
load_dotenv(dotenv_path=".env.local")

from routers.scans import router as scans_router

app = FastAPI(title="Džbánov Boardgaming API")

# Registrace routeru pro A4 skeny
app.include_router(scans_router)

@app.get("/")
def read_root():
    return {"message": "Džbánov Boardgaming API je v provozu!"}