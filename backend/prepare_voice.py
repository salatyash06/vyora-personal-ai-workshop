"""One-time online model download. Runtime speech recognition stays local."""
from pathlib import Path
from faster_whisper.utils import download_model

destination = Path(__file__).resolve().parent / "models" / "whisper-base"
download_model("base", output_dir=str(destination))
print(f"Speech model downloaded to {destination}")
print("You can now use local speech recognition without internet.")
