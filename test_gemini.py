import os
from dotenv import load_dotenv
from google import genai

# Načtení API klíče přímo ze souboru .env.local
load_dotenv(dotenv_path=".env.local")

api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-1.5-flash",
    contents="Ahoj, funguje připojení?"
)

print(response.text)