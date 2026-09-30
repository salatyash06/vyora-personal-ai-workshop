import json

import httpx

SYSTEM = """You are VYORA, a concise personal study and coding assistant running locally.
Answer naturally. You do not have live web results or access to the user's files.
Your conversation output cannot control the computer. Never claim you opened an app,
saved a note, sent a message, changed a setting, or ran a command. The separate command
router handles supported actions. When asked about computer actions, suggest typing help.
Be honest about uncertainty. Keep ordinary replies under 150 words unless more is requested."""


class Ollama:
    def __init__(self, model):
        self.model = model

    async def available(self):
        try:
            async with httpx.AsyncClient(trust_env=False, timeout=2) as client:
                response = await client.get("http://127.0.0.1:11434/api/tags")
                response.raise_for_status()
                names = [m["name"] for m in response.json().get("models", [])]
                return {"reachable": True, "model_ready": self.model in names}
        except (httpx.HTTPError, ValueError, KeyError):
            return {"reachable": False, "model_ready": False}

    async def stream(self, history, text):
        # Bound history size; SQLite still retains the complete successful exchanges.
        chosen, remaining = [], 6000
        for message in reversed(history):
            content = message["content"]
            if len(content) > remaining:
                break
            chosen.append({"role": message["role"], "content": content})
            remaining -= len(content)
        messages = [{"role": "system", "content": SYSTEM}, *reversed(chosen), {"role": "user", "content": text}]
        payload = {
            "model": self.model, "messages": messages, "stream": True, "think": False,
            "keep_alive": "5m", "options": {"num_ctx": 4096, "num_predict": 512, "temperature": 0.5},
        }
        timeout = httpx.Timeout(180, connect=5)
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            async with client.stream("POST", "http://127.0.0.1:11434/api/chat", json=payload) as response:
                if response.status_code == 404:
                    raise RuntimeError(f"Model not found. Run: ollama pull {self.model}")
                response.raise_for_status()
                completed = False
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    if chunk.get("error"):
                        raise RuntimeError(str(chunk["error"]))
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if chunk.get("done"):
                        completed = True
                if not completed:
                    raise RuntimeError("The model stream ended before completion. Please retry.")
