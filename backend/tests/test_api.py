import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

TOKEN = "test-connection-token-with-at-least-32-characters"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client(tmp_path):
    settings = SimpleNamespace(
        api_token=TOKEN, data_dir=tmp_path, model="qwen3:4b",
        origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        whisper_dir=tmp_path / "missing-model", mic_device=None, tts_rate=175,
        tts_voice="", cpu_threads=4,
    )
    with TestClient(create_app(settings)) as value:
        yield value


def new_conversation(client):
    response = client.post("/api/conversations", headers=HEADERS)
    assert response.status_code == 200
    return response.json()["id"]


def test_private_data_requires_token(client):
    assert client.get("/api/notes").status_code == 401
    assert client.get("/api/notes", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_untrusted_browser_origin_is_rejected(client):
    response = client.post("/api/conversations", headers={**HEADERS, "Origin": "https://untrusted.example"})
    assert response.status_code == 403


def test_note_command_is_persisted_and_chat_saved(client):
    conversation_id = new_conversation(client)
    response = client.post("/api/chat", headers=HEADERS, json={
        "conversation_id": conversation_id,
        "text": "save note: Revise 8085 interrupts at 7 PM",
    })
    assert response.status_code == 200
    assert '"type": "done"' in response.text
    notes = client.get("/api/notes", headers=HEADERS).json()
    assert notes[0]["content"] == "Revise 8085 interrupts at 7 PM"
    messages = client.get(f"/api/conversations/{conversation_id}/messages", headers=HEADERS).json()
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert "Saved" in messages[1]["content"]


def test_notes_survive_new_application_instance(client, tmp_path):
    conversation_id = new_conversation(client)
    client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "save note: persistent"})
    other = create_app(client.app.state.settings)
    with TestClient(other) as restarted:
        assert restarted.get("/api/notes", headers=HEADERS).json()[0]["content"] == "persistent"


def test_invalid_chat_does_not_create_history(client):
    conversation_id = new_conversation(client)
    response = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "   "})
    assert response.status_code == 422
    assert client.get(f"/api/conversations/{conversation_id}/messages", headers=HEADERS).json() == []


def test_missing_conversation_is_rejected(client):
    response = client.post("/api/chat", headers=HEADERS, json={"conversation_id": 999, "text": "help"})
    assert response.status_code == 404


def test_missing_voice_model_is_clear_error(client):
    response = client.post("/api/listen", headers=HEADERS, json={"seconds": 6})
    assert response.status_code == 503
    assert "prepare_voice" in response.json()["detail"]


def test_unknown_application_is_not_executed_or_sent_to_ai(client):
    conversation_id = new_conversation(client)
    response = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "open powershell -command whoami"})
    assert response.status_code == 200
    assert "registered" in response.text.lower()


def test_note_preserves_quotes_unicode_and_sql_like_text(client):
    conversation_id = new_conversation(client)
    content = "યશ's notes; DROP TABLE notes; हिन्दी"
    client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "save note: " + content})
    assert client.get("/api/notes", headers=HEADERS).json()[0]["content"] == content


def test_volume_out_of_range_never_reaches_hardware(client):
    conversation_id = new_conversation(client)
    response = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "set volume to 150 percent"})
    assert "0 to 100" in response.text


def test_successful_model_stream_is_saved_in_order(client, monkeypatch):
    async def fake_model(history, text):
        yield "Hello "
        yield "Yash."
    monkeypatch.setattr(client.app.state.llm, "stream", fake_model)
    conversation_id = new_conversation(client)
    response = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "hello"})
    events = [json.loads(line) for line in response.text.splitlines()]
    assert "".join(e["text"] for e in events if e["type"] == "token") == "Hello Yash."
    assert events[-1] == {"type": "done", "reply": "Hello Yash.", "source": "local-ai"}
    saved = client.get(f"/api/conversations/{conversation_id}/messages", headers=HEADERS).json()
    assert saved[-1]["content"] == "Hello Yash."


def test_failed_model_stream_does_not_save_partial_reply_and_releases_busy_state(client, monkeypatch):
    async def broken_model(history, text):
        yield "partial"
        raise RuntimeError("Model connection interrupted")
    monkeypatch.setattr(client.app.state.llm, "stream", broken_model)
    conversation_id = new_conversation(client)
    response = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "hello"})
    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[-1]["type"] == "error"
    assert client.get(f"/api/conversations/{conversation_id}/messages", headers=HEADERS).json() == []
    retry = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "help"})
    assert retry.status_code == 200
    assert '"type": "done"' in retry.text


def test_stop_cancels_generation_and_allows_next_request(client, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    import threading
    started = threading.Event()
    async def slow_model(history, text):
        started.set()
        yield "partial"
        await asyncio.sleep(60)
        yield "should not finish"
    monkeypatch.setattr(client.app.state.llm, "stream", slow_model)
    conversation_id = new_conversation(client)
    with ThreadPoolExecutor(max_workers=1) as executor:
        pending = executor.submit(client.post, "/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "hello"})
        assert started.wait(5)
        busy = client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "help"})
        assert busy.status_code == 409
        assert client.post("/api/stop", headers=HEADERS).status_code == 200
        response = pending.result(timeout=5)
    assert '"type": "cancelled"' in response.text
    assert client.get(f"/api/conversations/{conversation_id}/messages", headers=HEADERS).json() == []
    assert client.post("/api/chat", headers=HEADERS, json={"conversation_id": conversation_id, "text": "help"}).status_code == 200
