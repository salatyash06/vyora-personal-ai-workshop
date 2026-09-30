import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Settings:
    api_token: str
    data_dir: Path
    model: str
    origins: list[str]
    whisper_dir: Path
    mic_device: int | None
    tts_rate: int
    tts_voice: str
    cpu_threads: int

    @classmethod
    def load(cls):
        load_dotenv(ROOT / ".env")
        token = os.getenv("VYORA_API_TOKEN", "")
        if len(token) < 32:
            raise RuntimeError("Run python setup_local.py first to create your local connection token.")
        mic = os.getenv("MIC_DEVICE", "").strip()
        return cls(
            api_token=token, data_dir=ROOT / "data",
            model=os.getenv("OLLAMA_MODEL", "qwen3:4b"),
            origins=[x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8080,http://localhost:8080").split(",") if x.strip()],
            whisper_dir=ROOT / "models" / "whisper-base", mic_device=int(mic) if mic else None,
            tts_rate=int(os.getenv("TTS_RATE", "175")),
            tts_voice=os.getenv("TTS_VOICE_ID", ""), cpu_threads=4,
        )
