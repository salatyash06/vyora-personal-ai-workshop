"""Optional voice dependencies are imported only when a voice feature is used."""
import json
import os
import subprocess
import sys
import tempfile
import threading
import wave
from pathlib import Path


class VoiceCancelled(Exception):
    pass


class Voice:
    def __init__(self, settings):
        self.settings = settings
        self.cancel = threading.Event()
        self.stage = "idle"
        self.model = None

    def devices(self):
        import sounddevice as sd
        return [{"id": i, "name": d["name"]} for i, d in enumerate(sd.query_devices()) if d["max_input_channels"] > 0]

    def listen(self, seconds, device):
        import numpy as np
        import sounddevice as sd
        from faster_whisper import WhisperModel
        try:
            if self.cancel.is_set():
                raise VoiceCancelled()
            if self.model is None:
                self.stage = "loading speech model"
                self.model = WhisperModel(str(self.settings.whisper_dir), device="cpu", compute_type="int8", cpu_threads=self.settings.cpu_threads, local_files_only=True)
            if self.cancel.is_set():
                raise VoiceCancelled()
            chosen = device if device is not None else self.settings.mic_device
            sample_rate = int(sd.query_devices(chosen, "input")["default_samplerate"])
            block = max(1, sample_rate // 10)
            frames, remaining = [], int(sample_rate * seconds)
            self.stage = "listening"
            with sd.InputStream(samplerate=sample_rate, device=chosen, channels=1, dtype="int16") as stream:
                while remaining > 0:
                    if self.cancel.is_set():
                        raise VoiceCancelled()
                    count = min(block, remaining)
                    samples, overflow = stream.read(count)
                    if overflow:
                        raise RuntimeError("Microphone audio overflowed. Close heavy applications and try again.")
                    frames.append(samples.copy())
                    remaining -= count
            if self.cancel.is_set():
                raise VoiceCancelled()
            audio = np.concatenate(frames)
            self.stage = "transcribing"
            with tempfile.TemporaryDirectory(prefix="vyora-audio-") as directory:
                path = Path(directory) / "recording.wav"
                with wave.open(str(path), "wb") as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(sample_rate)
                    wav.writeframes(audio.astype("<i2").tobytes())
                segments, _ = self.model.transcribe(str(path), beam_size=1, vad_filter=True)
                parts = []
                for segment in segments:
                    if self.cancel.is_set():
                        raise VoiceCancelled()
                    parts.append(segment.text.strip())
                if self.cancel.is_set():
                    raise VoiceCancelled()
                return " ".join(parts).strip()
        finally:
            self.stage = "idle"


class Speaker:
    """A child process owns SAPI, so Stop can reliably terminate speech."""
    def __init__(self, settings):
        self.settings = settings
        self.process = None
        self.lock = threading.Lock()
        self.error = ""

    def _stop(self):
        if self.process is not None:
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=2)
            self.process = None

    def stop(self):
        with self.lock:
            self._stop()
            self.error = ""

    def status(self):
        with self.lock:
            if self.process is not None:
                code = self.process.poll()
                if code is None:
                    return {"speaking": True, "speech_error": ""}
                if code != 0:
                    self.error = "Speech failed. Check backend/data/tts-error.log and install requirements-voice.txt."
                self.process = None
            return {"speaking": False, "speech_error": self.error}

    def speak(self, text):
        if sys.platform != "win32":
            raise RuntimeError("This starter's speech output uses Windows SAPI5. Run the backend on Windows.")
        with self.lock:
            self._stop()
            self.error = ""
            self.settings.data_dir.mkdir(parents=True, exist_ok=True)
            with open(self.settings.data_dir / "tts-error.log", "w", encoding="utf-8") as log:
                self.process = subprocess.Popen(
                    [sys.executable, "-m", "app.tts_worker"], cwd=Path(__file__).resolve().parents[1],
                    stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                    env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                )
                payload = {"text": text, "rate": self.settings.tts_rate, "voice": self.settings.tts_voice}
                try:
                    self.process.stdin.write(json.dumps(payload).encode("utf-8"))
                    self.process.stdin.close()
                except OSError:
                    self._stop()
                    raise RuntimeError("Speech could not start. Check backend/data/tts-error.log.")
