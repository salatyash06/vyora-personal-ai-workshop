import secrets
from pathlib import Path

root = Path(__file__).resolve().parent
target = root / ".env"
if target.exists():
    print("Existing .env preserved. Open it to copy VYORA_API_TOKEN.")
else:
    template = (root / ".env.example").read_text(encoding="utf-8")
    token = secrets.token_urlsafe(36)
    with target.open("x", encoding="utf-8") as file:
        file.write(template.replace("VYORA_API_TOKEN=", "VYORA_API_TOKEN=" + token, 1))
    print("Created backend/.env. Open it and copy VYORA_API_TOKEN into the app's connection screen.")
print("Next: python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000")
