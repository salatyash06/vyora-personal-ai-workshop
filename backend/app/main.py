import asyncio
import json
import logging
import secrets
from contextlib import asynccontextmanager, suppress

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .actions import handle_command, system_info
from .config import Settings
from .database import Database
from .llm import Ollama
from .voice import Speaker, Voice, VoiceCancelled

logger = logging.getLogger("vyora")


class ChatRequest(BaseModel):
    conversation_id: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=3000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value):
        if not value.strip():
            raise ValueError("Please enter a message.")
        return value.strip()


class ListenRequest(BaseModel):
    seconds: int = Field(default=6, ge=2, le=15)
    device: int | None = Field(default=None, ge=0)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def create_app(settings=None):
    settings = settings or Settings.load()
    db = Database(settings.data_dir / "vyora.db")
    llm = Ollama(settings.model)
    voice, speaker = Voice(settings), Speaker(settings)
    operation_lock = asyncio.Lock()
    active = {"task": None, "voice_busy": False}

    @asynccontextmanager
    async def lifespan(app):
        yield
        voice.cancel.set()
        task = active["task"]
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        await asyncio.to_thread(speaker.stop)

    app = FastAPI(title="VYORA local backend", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.llm = llm
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])

    @app.middleware("http")
    async def check_origin(request, call_next):
        origin = request.headers.get("origin")
        if origin and origin not in settings.origins:
            return JSONResponse({"detail": "This frontend origin is not allowed."}, status_code=403)
        return await call_next(request)

    app.add_middleware(CORSMiddleware, allow_origins=settings.origins,
                       allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

    async def authorize(request: Request):
        expected = f"Bearer {settings.api_token}"
        actual = request.headers.get("authorization", "")
        if not secrets.compare_digest(actual.encode(), expected.encode()):
            raise HTTPException(401, "Invalid local token. Copy VYORA_API_TOKEN from backend/.env into the connection screen.")

    router = APIRouter(prefix="/api", dependencies=[Depends(authorize)])

    @app.get("/health")
    async def health():
        return {"status": "ok", "name": "VYORA"}

    @router.get("/status")
    async def status():
        return {"model": settings.model, **await llm.available(),
                "speech_model_ready": (settings.whisper_dir / "model.bin").is_file(),
                "voice_stage": voice.stage, "voice_busy": active["voice_busy"],
                "busy": operation_lock.locked(), **speaker.status()}

    @router.get("/system")
    async def system():
        return await asyncio.to_thread(system_info)

    @router.get("/conversations")
    async def conversations():
        return db.conversations()

    @router.post("/conversations")
    async def new_conversation():
        return db.create_conversation()

    @router.get("/conversations/{conversation_id}/messages")
    async def messages(conversation_id: int):
        if not db.exists(conversation_id):
            raise HTTPException(404, "Conversation not found.")
        return db.messages(conversation_id)

    @router.get("/notes")
    async def notes():
        return db.notes()

    @router.get("/audio/devices")
    async def devices():
        try:
            return await asyncio.to_thread(voice.devices)
        except Exception as exc:
            raise HTTPException(503, f"Audio unavailable. Install requirements-voice.txt and check your microphone. {exc}") from exc

    @router.post("/listen")
    async def listen(body: ListenRequest):
        if not (settings.whisper_dir / "model.bin").is_file():
            raise HTTPException(503, "Speech model missing. Install requirements-voice.txt, then run python prepare_voice.py.")
        if operation_lock.locked():
            raise HTTPException(409, "VYORA is busy. Stop the current operation first.")
        await operation_lock.acquire()
        active["voice_busy"] = True
        voice.cancel.clear()
        try:
            await asyncio.to_thread(speaker.stop)
            transcript = await asyncio.to_thread(voice.listen, body.seconds, body.device)
            return {"text": transcript, "cancelled": False}
        except VoiceCancelled:
            return {"text": "", "cancelled": True}
        except Exception as exc:
            logger.exception("Voice input failed")
            raise HTTPException(503, f"Voice input failed: {exc}") from exc
        finally:
            active["voice_busy"] = False
            operation_lock.release()

    @router.post("/speak")
    async def speak(body: SpeakRequest):
        if operation_lock.locked():
            raise HTTPException(409, "Wait for the current operation before starting speech.")
        try:
            speaker.speak(body.text)
            return {"started": True}
        except Exception as exc:
            raise HTTPException(503, str(exc)) from exc

    @router.post("/stop")
    async def stop():
        voice.cancel.set()
        task = active["task"]
        if task is not None and not task.done():
            task.cancel()
        await asyncio.to_thread(speaker.stop)
        return {"requested": True}

    @router.post("/chat")
    async def chat(body: ChatRequest):
        if not db.exists(body.conversation_id):
            raise HTTPException(404, "Conversation not found.")
        if operation_lock.locked():
            raise HTTPException(409, "VYORA is busy. Stop the current operation first.")
        await operation_lock.acquire()
        try:
            await asyncio.to_thread(speaker.stop)
        except BaseException:
            operation_lock.release()
            raise
        queue = asyncio.Queue()

        async def produce():
            try:
                await queue.put({"type": "state", "value": "thinking"})
                action_result = await asyncio.to_thread(handle_command, body.text, db)
                if action_result is not None:
                    reply = action_result
                    await queue.put({"type": "token", "text": reply})
                    source = "command"
                else:
                    parts = []
                    async for token in llm.stream(db.messages(body.conversation_id, 20), body.text):
                        parts.append(token)
                        await queue.put({"type": "token", "text": token})
                    reply = "".join(parts).strip()
                    if not reply:
                        raise RuntimeError("The model returned an empty reply. Please retry.")
                    source = "local-ai"
                db.save_exchange(body.conversation_id, body.text, reply)
                await queue.put({"type": "done", "reply": reply, "source": source})
            except asyncio.CancelledError:
                await queue.put({"type": "cancelled"})
            except httpx.ConnectError:
                await queue.put({"type": "error", "message": "Ollama is not running. Open Ollama on your laptop and retry."})
            except httpx.TimeoutException:
                await queue.put({"type": "error", "message": "The model timed out. Try qwen3:1.7b or close heavy applications."})
            except Exception as exc:
                logger.exception("Request failed")
                await queue.put({"type": "error", "message": str(exc) or "The request failed."})
            finally:
                await queue.put(None)

        async def events():
            task = asyncio.create_task(produce())
            active["task"] = task
            try:
                while True:
                    event = await queue.get()
                    if event is None:
                        break
                    yield json.dumps(event, ensure_ascii=False) + "\n"
            finally:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
                active["task"] = None
                operation_lock.release()

        return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})

    app.include_router(router)
    return app
