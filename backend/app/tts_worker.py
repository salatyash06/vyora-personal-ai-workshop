import json
import sys


def main():
    import pyttsx3
    payload = json.load(sys.stdin)
    engine = pyttsx3.init("sapi5")
    engine.setProperty("rate", payload["rate"])
    if payload.get("voice"):
        engine.setProperty("voice", payload["voice"])
    engine.say(payload["text"])
    engine.runAndWait()
    engine.stop()


if __name__ == "__main__":
    main()
