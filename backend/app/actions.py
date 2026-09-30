"""Exact, allowlisted commands. Model output is never passed to these functions."""
import os
import re
import subprocess
import sys
import webbrowser
from datetime import datetime
from urllib.parse import quote_plus

import psutil

HELP = """Commands available now:
• open calculator / open notepad / open file explorer
• open youtube / open google
• search web for <your search>
• set volume to 30 percent
• system status / battery level / what time is it
• save note: <your note> / show notes
• help
Other messages go to local AI chat. It cannot execute generated code or arbitrary actions."""


def system_info():
    memory = psutil.virtual_memory()
    battery = psutil.sensors_battery()
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": memory.percent,
        "memory_used_gb": round(memory.used / 1024**3, 1),
        "memory_total_gb": round(memory.total / 1024**3, 1),
        "battery_percent": round(battery.percent) if battery else None,
        "plugged_in": battery.power_plugged if battery else None,
    }


def handle_command(text, db):
    """Return None for ordinary chat, or a result for a supported/blocked command."""
    clean = text.strip()
    normalized = clean.lower().rstrip(".?!")
    result = None
    if normalized in {"help", "commands", "what can you do"}:
        result = HELP
    elif normalized in {"time", "what time is it", "date", "what is the date"}:
        result = datetime.now().astimezone().strftime("It is %I:%M %p on %A, %d %B %Y (%Z).")
    elif normalized in {"system status", "battery level", "show battery level"}:
        info = system_info()
        battery = "not reported" if info["battery_percent"] is None else str(info["battery_percent"]) + "%"
        result = f"CPU: {info['cpu_percent']}%. RAM: {info['memory_percent']}%. Battery: {battery}."
    elif normalized.startswith("save note"):
        match = re.fullmatch(r"save note\s*:\s*(.+)", clean, re.I | re.S)
        if match and match.group(1).strip():
            note_id = db.add_note(match.group(1).strip())
            result = f"Saved note #{note_id}."
        else:
            result = "Use: save note: your note text"
    elif normalized in {"show notes", "list notes"}:
        notes = db.notes()[:20]
        result = "\n".join(f"{n['id']}. {n['content']}" for n in notes) if notes else "You have no saved notes yet."
    elif normalized.startswith("set volume"):
        match = re.fullmatch(r"set volume(?: to)?\s+(-?\d+)(?:\s*percent|%)?", normalized)
        if not match or not 0 <= int(match.group(1)) <= 100:
            result = "Use a volume from 0 to 100, for example: set volume to 30 percent."
        elif sys.platform != "win32":
            result = "Volume control is available when this backend runs on Windows."
        else:
            import comtypes
            comtypes.CoInitialize()
            try:
                from pycaw.pycaw import AudioUtilities
                endpoint = AudioUtilities.GetSpeakers().EndpointVolume
                value = int(match.group(1))
                endpoint.SetMasterVolumeLevelScalar(value / 100, None)
                measured = round(endpoint.GetMasterVolumeLevelScalar() * 100)
                result = f"Volume set to {measured}%."
            finally:
                comtypes.CoUninitialize()
    elif normalized.startswith("open "):
        name = normalized[5:].strip()
        urls = {"youtube": "https://www.youtube.com", "google": "https://www.google.com"}
        windows = os.environ.get("SystemRoot", r"C:\Windows")
        apps = {
            "calculator": [os.path.join(windows, "System32", "calc.exe")],
            "notepad": [os.path.join(windows, "System32", "notepad.exe")],
            "file explorer": [os.path.join(windows, "explorer.exe")],
        }
        if name in urls:
            opened = webbrowser.open(urls[name])
            result = f"Sent {name} to your browser." if opened else "The browser did not accept the request."
        elif name in apps and sys.platform == "win32":
            subprocess.Popen(apps[name], shell=False)
            result = f"Launch request sent for {name}."
        elif name in apps:
            result = "Application launching is available when this backend runs on Windows."
        else:
            result = "That application is not registered. Try open calculator, open notepad, or open file explorer."
    elif normalized.startswith("search web for "):
        query = clean[len("search web for "):].strip()
        if not query:
            result = "Please include the search words."
        else:
            opened = webbrowser.open("https://www.google.com/search?q=" + quote_plus(query))
            result = "Sent your search to the browser. Internet is required for results." if opened else "The browser did not accept the request."
    elif normalized.startswith(("run ", "execute ", "delete ", "shutdown", "shut down", "send ")):
        result = "That action is not enabled in this starter. Type help for supported commands."
    if result is not None:
        db.log_action(clean, result)
    return result
